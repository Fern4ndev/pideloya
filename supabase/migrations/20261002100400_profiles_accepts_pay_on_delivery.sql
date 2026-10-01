-- ============================================================================
-- PideloYa — Protección del repartidor (D7): "acepto que el cliente pague al
-- recibir" (adelanto la comida de mi dinero)
-- ============================================================================
-- Fase 7 del plan "Pagar al recibir con Yape o Efectivo".
--
-- El repartidor es quien pone plata cuando el cliente elige pagar al recibir:
-- adelanta el importe de la comida al restaurante y cobra al entregar. Hasta
-- ahora eso era obligatorio para todo repartidor en cuanto existía el efectivo.
-- Con este interruptor puede apagarlo y ofertar solo con pago por adelantado.
--
-- Patrón EXPAND: la columna nace con `default true`, que ES el comportamiento
-- actual (el efectivo ya existía), así que el código desplegado sigue igual
-- hasta que se despliegue la Fase 4 (que deshabilita la opción en el cliente) y
-- esta UI de perfil. Sin backfill: `add column ... default` ya deja `true` en
-- todas las filas existentes.
--
-- El flag NO se lee en vivo desde `profiles` al confirmar el pago: `offer_delivery`
-- lo copia a `deliveries.allows_pay_on_delivery` al enviar la oferta (snapshot,
-- ver 20261002100000). Motivo: el cliente puede tardar horas en decidir, y si el
-- repartidor apaga el interruptor mientras tanto, la oferta ya enviada NO cambia
-- — el cliente no puede ver retirarse una promesa que ya tenía delante.
-- ============================================================================

alter table public.profiles
  add column if not exists accepts_pay_on_delivery boolean not null default true;

comment on column public.profiles.accepts_pay_on_delivery is
  'D7 (Fase 7): el repartidor acepta cobrar al recibir, adelantando la comida de su dinero. Default true = comportamiento histórico (el efectivo ya existía). Solo se copia a deliveries.allows_pay_on_delivery al enviar la oferta (snapshot): cambiarlo después no altera ofertas ya enviadas.';


-- ----------------------------------------------------------------------------
-- offer_delivery: misma firma, misma lógica, + el snapshot del flag.
--
-- `create or replace` (no DROP): la firma no cambia, así que las rutas
-- desplegadas de `app/api/v1/**` y las Server Actions siguen llamando a la
-- misma función sin ventana de indisponibilidad. Al reemplazar se conservan
-- los GRANTs existentes, pero se repiten al final por si esta migración se
-- aplica sobre un entorno donde el archivo ...100300 no dejó los suyos.
--
-- El flag se lee en el MISMO `select ... for update` que ya bloquea la fila de
-- `profiles` (es el mutex por repartidor): sin una segunda consulta y sin
-- ventana entre "leo el flag" y "escribo el snapshot".
-- ----------------------------------------------------------------------------
create or replace function public.offer_delivery(p_order_id uuid, p_delivery_fee numeric)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid;
  v_role public.user_role;
  v_is_active boolean;
  v_accepts_on_delivery boolean;
  v_status public.order_status;
  v_active_id uuid;
begin
  v_profile_id := public.current_profile_id();
  if v_profile_id is null then
    raise exception 'No autenticado'
      using errcode = '42501';
  end if;

  -- FOR UPDATE sobre la propia fila de profile: serializa dos ofertas
  -- simultáneas del MISMO repartidor. Es el mutex más barato que tenemos
  -- (una fila por persona, ya existe, y hay que leerla igual para validar
  -- rol/estado de la cuenta). De paso trae el flag de D7 para el snapshot.
  select role, is_active, accepts_pay_on_delivery
    into v_role, v_is_active, v_accepts_on_delivery
  from public.profiles
  where id = v_profile_id
  for update;

  if v_role is distinct from 'DELIVERY' then
    raise exception 'Solo los repartidores pueden ofertar un envío'
      using errcode = '42501';
  end if;

  if v_is_active is not true then
    raise exception 'Tu cuenta está desactivada'
      using errcode = '42501';
  end if;

  if p_delivery_fee is null or p_delivery_fee <= 0 then
    raise exception 'La tarifa de envío debe ser mayor a cero'
      using errcode = '22000';
  end if;

  -- Una sola entrega/oferta activa por repartidor. AWAITING_PAYMENT cuenta:
  -- esperar a que le paguen es estar ocupado, no libre.
  select d.id
    into v_active_id
  from public.deliveries d
  join public.orders o on o.id = d.order_id
  where d.delivery_person_id = v_profile_id
    and o.status in ('AWAITING_PAYMENT', 'ASSIGNED', 'PICKED_UP', 'ON_THE_WAY')
  limit 1;

  if v_active_id is not null then
    raise exception 'Ya tienes una oferta o entrega activa. Complétala antes de ofertar en otra.'
      using errcode = '23505';
  end if;

  select status
    into v_status
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'Este pedido ya no está disponible'
      using errcode = 'P0002';
  end if;

  if v_status is distinct from 'PENDING' then
    raise exception 'Este pedido ya no está disponible'
      using errcode = '22000';
  end if;

  if exists (select 1 from public.deliveries where order_id = p_order_id) then
    raise exception 'Alguien más ya está ofertando en este pedido'
      using errcode = '23505';
  end if;

  insert into public.deliveries (
    order_id,
    delivery_person_id,
    delivery_fee,
    offered_at,
    allows_pay_on_delivery
  )
  values (
    p_order_id,
    v_profile_id,
    p_delivery_fee,
    now(),
    v_accepts_on_delivery
  );

  update public.orders
  set status = 'AWAITING_PAYMENT'
  where id = p_order_id
    and status = 'PENDING';

  if not found then
    raise exception 'El pedido cambió de estado antes de poder enviar tu oferta'
      using errcode = '40001';
  end if;
end;
$$;

-- Superficie mínima, igual que en 20261002100300: en Supabase `anon` recibe
-- EXECUTE por defecto sobre funciones del schema public, así que se revoca
-- explícitamente. Solo un usuario autenticado la invoca, y la función valida
-- identidad y rol por dentro.
revoke all on function public.offer_delivery(uuid, numeric) from public, anon;
grant execute on function public.offer_delivery(uuid, numeric) to authenticated;
