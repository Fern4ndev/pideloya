-- ============================================================================
-- PideloYa — pickup_delivery(uuid, boolean): recoger y declarar el pago al
-- restaurante en la misma transacción
-- ============================================================================
-- (D6) La observación que abre este plan: con pago al recibir, el repartidor
-- ADELANTA la comida con su propio dinero al recoger. Hasta hoy esa operación
-- era invisible: el restaurante "sabía" porque el repartidor le pagaba en mano,
-- pero nadie podía probar quién cobró qué y cuándo. Esta función convierte el
-- paso ASSIGNED -> PICKED_UP en la transición atómica donde queda la constancia
-- `orders.restaurant_paid_at`.
--
-- ¿Por qué `restaurant_paid_at` en orders y no en deliveries? Para que el
-- RESTAURANTE pueda leerlo con las policies que ya tiene sobre sus pedidos
-- (orders_select_restaurant_readonly), sin abrir ninguna policy nueva en
-- `deliveries`. Y porque sobrevive al borrado del repartidor (ON DELETE SET
-- NULL).
--
-- La transición PICKED_UP en sí ya existía como UPDATE directo (RLS
-- orders_update_delivery_assigned + update de picked_up_at en la Server Action).
-- No se prohibe ese camino en esta fase: la app desplegada lo usa. Lo que esta
-- función agrega es el camino CON constancia de pago; que sea la única puerta es
-- la migración de endurecimiento de la Fase 12.
--
-- Idempotencia del pago (D6): `coalesce` — si el repartidor reintenta (o la red
-- repite la llamada), la evidencia NO se reescribe con una hora nueva.
-- ============================================================================

create function public.pickup_delivery(
  p_order_id uuid,
  p_restaurant_paid boolean default false
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
begin
  if v_profile_id is null then
    raise exception 'No autenticado'
      using errcode = '42501';
  end if;

  -- Orden de locks: `orders` primero, `deliveries` después — el mismo de
  -- select_delivery_payment, complete_delivery, retract_delivery_offer y
  -- expire_stale_delivery_offers (evita el deadlock AB-BA).
  select status into v_status
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'Pedido no encontrado'
      using errcode = 'P0002';
  end if;

  select id into v_delivery_id
  from public.deliveries
  where order_id = p_order_id
    and delivery_person_id = v_profile_id
  for update;

  if not found then
    raise exception 'No tienes este pedido asignado'
      using errcode = '42501';
  end if;

  if v_status is distinct from 'ASSIGNED' then
    raise exception 'El pedido no está listo para recoger'
      using errcode = '22000';
  end if;

  update public.deliveries
     set picked_up_at = now()
   where id = v_delivery_id;

  update public.orders
     set status = 'PICKED_UP',
         -- Idempotente a propósito: reintentar no reescribe la evidencia.
         restaurant_paid_at = case
           when p_restaurant_paid is true then coalesce(restaurant_paid_at, now())
           else restaurant_paid_at
         end
   where id = p_order_id
     and status = 'ASSIGNED';

  if not found then
    raise exception 'El pedido cambió de estado antes de marcarlo recogido'
      using errcode = '40001';
  end if;
end;
$$;

revoke all on function public.pickup_delivery(uuid, boolean) from public, anon;
grant execute on function public.pickup_delivery(uuid, boolean) to authenticated;
