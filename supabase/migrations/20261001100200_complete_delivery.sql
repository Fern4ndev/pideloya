-- ============================================================================
-- PideloYa — complete_delivery(uuid, boolean): entregar y, con efectivo, cobrar
-- en la misma transacción
-- ============================================================================
-- Hasta acá el último paso (ON_THE_WAY -> DELIVERED) eran DOS updates sueltos
-- desde la Server Action: `orders.status` y `deliveries.delivered_at`. Si el
-- segundo fallaba, quedaba un pedido entregado sin hora de entrega y nadie se
-- enteraba. Con efectivo el problema deja de ser cosmético: hay que registrar el
-- COBRO (D6) junto con la entrega, y "entregado pero sin constancia de cobro" es
-- exactamente el estado que genera el "no me pagaron" en ambos sentidos.
--
-- Por eso el paso pasa a esta función atómica. No hay nada específico de CASH
-- dentro: para Yape (y para las entregas legacy sin método) hace lo mismo que
-- antes y el flag se ignora.
--
-- (D6) El flag es del repartidor porque es el único que estaba ahí. Con CASH el
-- monto que cobra es orders.total + orders.delivery_fee; no se guarda el monto:
-- los dos sumandos son snapshots que ya no cambian después de confirmar el pago,
-- así que el monto es derivable y no puede desincronizarse.
--
-- LÍMITE CONOCIDO (honesto): la policy `orders_update_delivery_assigned` todavía
-- permite escribir DELIVERED por PATCH directo, así que un repartidor que use la
-- API cruda —no la app— podría saltarse la confirmación del cobro. La app pasa
-- siempre por acá. Endurecer la policy (quitar DELIVERED de su `with check`) se
-- hace en la Fase 10, DESPUÉS de que este camino esté desplegado y probado: si
-- se hiciera ahora, rompería el código que hoy todavía hace el UPDATE directo.
-- ============================================================================

create or replace function public.complete_delivery(
  p_order_id uuid,
  p_cash_collected boolean default false
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

  -- La pertenencia se verifica por la FILA de la entrega y no por el rol: es la
  -- comprobación más fuerte (el rol dice qué es; la fila dice de quién es ESTE
  -- pedido) y la misma que ya hace la Server Action con `.eq(delivery_person_id,
  -- profileId)`. Un admin que llame acá recibe 42501 a propósito: el override de
  -- soporte del admin vive en la ruta de la API, no acá.
  select id, payment_method
    into v_delivery_id, v_method
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

  -- La guarda REAL del cobro. El diálogo de la UI es la UX; esto es lo que hace
  -- imposible marcar entregado un pedido en efectivo sin declarar que se cobró
  -- (ni por Server Action ni por la API v1).
  if v_method = 'CASH' and p_cash_collected is not true then
    raise exception 'Confirma que cobraste el envío en efectivo antes de marcar la entrega'
      using errcode = '22000';
  end if;

  update public.deliveries
     set delivered_at = now(),
         cash_collected_at = case when v_method = 'CASH' then now() end
   where id = v_delivery_id;

  update public.orders
     set status = 'DELIVERED'
   where id = p_order_id
     and status = 'ON_THE_WAY';

  -- Mismo criterio que las otras transiciones: si el estado cambió entre el
  -- SELECT y el UPDATE, la excepción revierte también el `delivered_at`, así que
  -- nunca queda una entrega marcada como entregada con el pedido sin entregar.
  if not found then
    raise exception 'El pedido cambió de estado antes de marcarlo entregado'
      using errcode = '40001';
  end if;
end;
$$;

revoke all on function public.complete_delivery(uuid, boolean) from public, anon;
grant execute on function public.complete_delivery(uuid, boolean) to authenticated;
