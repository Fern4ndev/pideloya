-- ============================================================================
-- PideloYa — complete_delivery v2: cobro genérico declarado por el repartidor
-- ============================================================================
-- (D4) Lo que se cobra al recibir puede ser Yape o efectivo INDEPENDIENTEMENTE
-- de lo que el cliente anunció. La función pide la CONFIRMACIÓN del cobro
-- (antes de marcar entregado) y registra el medio REAL declarado:
--
--   * p_cash_collected (nombre legado, semánticamente "cobré"): el flag que ya
--     mandan los llamadores desplegados. true sin medio => efectivo.
--   * p_collected_method: NUEVO. 'YAPE' | 'CASH'. Gana sobre el flag.
--
-- ON_DELIVERY sin ninguno de los dos => 22000 "Confirma que cobraste": el
-- incentivo a marcar entregado sin cobrar existe; la base es la que no deja.
--
-- UPFRONT (y legacy sin método): se ignoran los flags, como hoy — ese dinero ya
-- se movió por adelantado.
--
-- DUAL-WRITE de compatibilidad: cuando el medio cobrado es efectivo se sigue
-- escribiendo cash_collected_at, porque la app desplegada (detalle del
-- repartidor) lo lee. Se elimina en la Fase 12 contract. Con Yape cobrado,
-- cash_collected_at queda NULL: el CHECK viejo
-- (cash_collected_requires_cash_check) fue reemplazado en 20261002100000
-- precisamente para que pago_method='YAPE' + collected_method='CASH' (o viceversa)
-- puedan convivir.
--
-- DROP + CREATE en la misma transacción por el mismo motivo que
-- select_delivery_payment v2: la firma cambia y una sobrecarga sería ambigua.
-- Los llamadores desplegados (Server Action + API v1) mandan solo
-- (p_order_id, p_cash_collected): los defaults mantienen su camino exacto.
-- ============================================================================

drop function if exists public.complete_delivery(uuid, boolean);

create function public.complete_delivery(
  p_order_id uuid,
  p_cash_collected boolean default false,
  p_collected_method text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid := public.current_profile_id();
  v_status public.order_status;
  v_delivery_id uuid;
  v_method text;
  v_timing text;
  v_collected_method text;
begin
  if v_profile_id is null then
    raise exception 'No autenticado'
      using errcode = '42501';
  end if;

  -- Orden de locks: `orders` primero, `deliveries` después — el mismo de
  -- select_delivery_payment, retract_delivery_offer y
  -- expire_stale_delivery_offers (evita el deadlock AB-BA).
  select status into v_status
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'Pedido no encontrado'
      using errcode = 'P0002';
  end if;

  -- Pertenencia por la FILA de la entrega (más fuerte que el rol): la misma
  -- comprobación que hace la Server Action con
  -- .eq('delivery_person_id', profileId). Un admin que llame acá recibe 42501
  -- a propósito: su override de soporte vive en la ruta de la API.
  select id, payment_method, payment_timing
    into v_delivery_id, v_method, v_timing
  from public.deliveries
  where order_id = p_order_id
    and delivery_person_id = v_profile_id
  for update;

  if not found then
    raise exception 'No tienes este pedido asignado'
      using errcode = '42501';
  end if;

  if v_status is distinct from 'ON_THE_WAY' then
    raise exception 'El pedido no está en camino'
      using errcode = '22000';
  end if;

  -- Derivación del medio cobrado. SOLO un pedido ON_DELIVERY registra cobro:
  -- en UPFRONT (y en las entregas legacy sin método) el dinero ya se movió por
  -- adelantado, así que los flags se IGNORAN por completo, como en la versión
  -- vigente — registrarlos chocaría además con el CHECK deliveries_collected_check.
  -- Dentro de ON_DELIVERY el parámetro nuevo gana; el flag legado significa
  -- efectivo (todo lo que existía ayer era efectivo).
  if v_timing = 'ON_DELIVERY' then
    if p_collected_method is not null then
      if p_collected_method not in ('YAPE', 'CASH') then
        raise exception 'Medio de cobro inválido'
          using errcode = '22000';
      end if;
      v_collected_method := p_collected_method;
    elsif p_cash_collected is true then
      v_collected_method := 'CASH';
    end if;
  else
    v_collected_method := null;
  end if;

  -- La guarda REAL del cobro (D4/D8): un pedido que se paga al recibir no se
  -- cierra sin declarar el medio. El diálogo de la UI es la UX; esto es lo que
  -- hace imposible "entregado sin constancia de cobro" ni por Server Action ni
  -- por la API v1.
  if v_timing = 'ON_DELIVERY' and v_collected_method is null then
    raise exception 'Confirma que cobraste antes de marcar la entrega'
      using errcode = '22000';
  end if;

  update public.deliveries
     set delivered_at = now(),
         collected_at = case when v_collected_method is not null then now() end,
         collected_method = v_collected_method,
         -- Dual-write hasta la Fase 12: la app desplegada lee esta columna.
         cash_collected_at = case when v_collected_method = 'CASH' then now() end
   where id = v_delivery_id;

  update public.orders
     set status = 'DELIVERED'
   where id = p_order_id
     and status = 'ON_THE_WAY';

  -- Si el estado cambió entre el SELECT y el UPDATE, la excepción revierte
  -- también el update de deliveries: nunca queda una entrega "a medias".
  if not found then
    raise exception 'El pedido cambió de estado antes de marcarlo entregado'
      using errcode = '40001';
  end if;
end;
$$;

revoke all on function public.complete_delivery(uuid, boolean, text) from public, anon;
grant execute on function public.complete_delivery(uuid, boolean, text) to authenticated;
