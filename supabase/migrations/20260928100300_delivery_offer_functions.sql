-- ============================================================================
-- PideloYa — Funciones atómicas de la oferta de envío
-- ============================================================================
-- Requiere 20260928100000 (enum), ...100100 (columnas) y ...100200 (RLS).
--
-- ¿Por qué estas dos operaciones son funciones y no Server Actions con el
-- cliente autenticado (como proponía el plan de implementación)?
--
-- Desviación deliberada del plan, por el mismo motivo por el que el propio
-- plan creó confirm_delivery_payment(): son transiciones que tocan DOS tablas
-- (deliveries + orders) y que deben ser ATÓMICAS.
--
--   - Ofertar: si el INSERT en `deliveries` tuviera éxito y el UPDATE del
--     pedido fallara a mitad de camino, quedaría una fila de entrega sin
--     pedido en AWAITING_PAYMENT: el repartidor no la vería en "Mis
--     entregas" (esa lista filtra por estado del pedido), el pedido seguiría
--     apareciendo en "Disponibles" para otros, y el UNIQUE(order_id) les
--     impediría tomarlo. Un callejón sin salida para las dos partes.
--   - Retirar: el orden inverso dejaría un pedido AWAITING_PAYMENT sin
--     repartidor, con el cliente viendo "confirma el pago" para siempre.
--
-- Y una tercera razón de concurrencia: la regla "un repartidor, una entrega
-- activa" (que ahora también cuenta las ofertas sin confirmar) no se puede
-- garantizar con un SELECT previo en la capa de aplicación — dos peticiones
-- simultáneas del mismo repartidor (doble clic, dos pestañas) pasan las dos
-- por el chequeo. Acá se serializa bloqueando la fila de `profiles`, que es
-- el mutex natural por repartidor.
--
-- Efecto secundario bueno: las rutas de `app/api/v1/**` dejan de necesitar
-- service role y de reimplementar la lógica. Llaman a la MISMA función que
-- las Server Actions, con el cliente autenticado por Bearer.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- offer_delivery: PENDING -> AWAITING_PAYMENT (el repartidor propone tarifa)
--
-- Atómica: inserta la fila de `deliveries` con la tarifa y el momento de la
-- oferta, y pasa el pedido a AWAITING_PAYMENT en la misma transacción.
--
-- Guardas, en orden y todas necesarias:
--   1. Hay sesión (current_profile_id) — sin esto, un llamador sin auth
--      (service_role vía adminClient) podría ofertar en nombre de nadie.
--   2. El llamador es un repartidor ACTIVO. Sin esta guarda, un cliente
--      podría insertarse a sí mismo como delivery_person_id de su propio
--      pedido y luego "confirmar" su pago: corrupción de datos con premio.
--   3. La tarifa es positiva (misma invariante que el CHECK de la tabla;
--      acá se adelanta para dar un mensaje legible en vez de un 23514).
--   4. No tiene ya una oferta o entrega activa.
--   5. El pedido existe y está PENDING (con FOR UPDATE: dos repartidores
--      compitiendo por el mismo pedido se serializan acá, y el UNIQUE
--      (order_id) queda como red de seguridad de último recurso).
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
  -- rol/estado de la cuenta).
  select role, is_active
    into v_role, v_is_active
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

  -- Una sola entrega/ oferta activa por repartidor. AWAITING_PAYMENT cuenta:
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

  insert into public.deliveries (order_id, delivery_person_id, delivery_fee, offered_at)
  values (p_order_id, v_profile_id, p_delivery_fee, now());

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


-- ----------------------------------------------------------------------------
-- retract_delivery_offer: AWAITING_PAYMENT -> PENDING (el repartidor se baja)
--
-- Borra la fila de `deliveries` (la oferta nunca se cobró) y devuelve el
-- pedido al pool, en una sola transacción. Reemplaza la versión con service
-- role que proponía el plan: acá la autorización vive en la función, así que
-- no hace falta ningún cliente privilegiado y no hay ventana de estado
-- inconsistente.
--
-- Se permite retirar SOLO mientras el cliente no confirmó el pago: una vez
-- confirmado, el pedido ya arrancó (ASSIGNED) y deshacerlo es una decisión de
-- soporte, no de autoservicio. La guarda de estado + la de
-- payment_confirmed_at cubren ese caso con mensajes distintos.
-- ----------------------------------------------------------------------------
create or replace function public.retract_delivery_offer(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid;
  v_status public.order_status;
  v_delivery_id uuid;
  v_confirmed_at timestamptz;
begin
  v_profile_id := public.current_profile_id();
  if v_profile_id is null then
    raise exception 'No autenticado'
      using errcode = '42501';
  end if;

  -- ORDEN DE BLOQUEOS (importante): primero `orders`, después `deliveries`.
  -- confirm_delivery_payment() bloquea en ese mismo orden, así que respetarlo
  -- acá evita un deadlock AB-BA entre "el cliente confirma" y "el repartidor
  -- se retira" cuando ambos caen en el mismo instante sobre el mismo pedido
  -- (Postgres lo detectaría y abortaría a uno con un error confuso).
  select status
    into v_status
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'No tienes ninguna oferta activa en este pedido'
      using errcode = 'P0002';
  end if;

  select d.id, d.payment_confirmed_at
    into v_delivery_id, v_confirmed_at
  from public.deliveries d
  where d.order_id = p_order_id
    and d.delivery_person_id = v_profile_id
  for update;

  if not found then
    raise exception 'No tienes ninguna oferta activa en este pedido'
      using errcode = 'P0002';
  end if;

  -- El mensaje de "ya confirmado" gana sobre el de estado: es el caso que el
  -- repartidor necesita entender (no es que la oferta desapareció, es que el
  -- cliente ya pagó y el pedido arrancó).
  if v_confirmed_at is not null then
    raise exception 'El cliente ya confirmó el pago: esta oferta no se puede retirar'
      using errcode = '23505';
  end if;

  if v_status is distinct from 'AWAITING_PAYMENT' then
    raise exception 'El pedido ya no está esperando un pago'
      using errcode = '22000';
  end if;

  delete from public.deliveries where id = v_delivery_id;

  update public.orders
  set status = 'PENDING'
  where id = p_order_id
    and status = 'AWAITING_PAYMENT';

  if not found then
    raise exception 'El pedido cambió de estado antes de poder retirar la oferta'
      using errcode = '40001';
  end if;
end;
$$;


-- Superficie mínima, igual que confirm_delivery_payment: en Supabase `anon`
-- recibe EXECUTE por defecto sobre funciones nuevas del schema public, así que
-- hay que revocarlo explícitamente. Solo un usuario autenticado puede
-- invocarlas; ambas validan además identidad y rol por dentro.
revoke all on function public.offer_delivery(uuid, numeric) from public, anon;
grant execute on function public.offer_delivery(uuid, numeric) to authenticated;

revoke all on function public.retract_delivery_offer(uuid) from public, anon;
grant execute on function public.retract_delivery_offer(uuid) to authenticated;
