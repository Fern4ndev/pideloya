-- ============================================================================
-- PideloYa — CONTRACT: revocar escritura directa (C2/H5, Fase 1.3d + 3.2)
-- ============================================================================
-- ⚠️ MIGRACIÓN CONTRACT — aplicar SOLO después de:
--   1. 20261003120100 (cancel_order / start_route) y 20261003120700
--      (create_order) aplicadas.
--   2. El código nuevo desplegado y verificado (cancelOrder, advanceOrderStatus,
--      createOrder y la API v1 llaman a las RPCs; suites verdes).
--
-- Motivo:
--   Con TODAS las transiciones de estado y la creación de pedidos dentro de
--   RPCs SECURITY DEFINER, la app ya no necesita escribir orders/deliveries/
--   order_items con la sesión del usuario. Revocar cierra el último vector de
--   manipulación directa: un repartidor no puede PATCH orders {total: 0} ni
--   POST deliveries; un cliente no puede crear/editar filas a mano.
--
--   El admin (service_role en Server Actions) no se ve afectado. Realtime solo
--   necesita SELECT. INSERT de direcciones/horarios/categorías/productos NO se
--   revoca (es escritura legítima del dueño via RLS).
--
--   Las policies de escritura por fila pasan a ser inertes con los revokes y
--   se eliminan para no confundir (sus definiciones verbatim quedan en el
--   rollback).
--
-- Rollback (comentado, verbatim del estado anterior):
--   grant insert, update, delete on public.deliveries to authenticated;
--   grant update, delete on public.orders to authenticated;
--   grant insert on public.orders to authenticated;
--   grant insert on public.order_items to authenticated;
--   -- orders_update_delivery_assigned (versión 20260928100200):
--   create policy "orders_update_delivery_assigned"
--   on public.orders for update
--   using (
--     public.current_role() = 'DELIVERY'
--     and id in (select public.current_delivery_order_ids())
--   )
--   with check (
--     status in ('AWAITING_PAYMENT', 'ASSIGNED', 'PICKED_UP', 'ON_THE_WAY', 'DELIVERED')
--   );
--   -- orders_update_own_customer_cancel (versión 20260928100200):
--   create policy "orders_update_own_customer_cancel"
--   on public.orders for update
--   using (
--     customer_id = public.current_profile_id()
--     and status in ('PENDING', 'AWAITING_PAYMENT')
--   )
--   with check (status = 'CANCELLED');
--   -- deliveries_insert_delivery_self (20260823172245):
--   create policy "deliveries_insert_delivery_self"
--   on public.deliveries for insert
--   with check (
--     public.current_role() = 'DELIVERY'
--     and delivery_person_id = public.current_profile_id()
--   );
--   -- deliveries_update_delivery_self (20260823172245):
--   create policy "deliveries_update_delivery_self"
--   on public.deliveries for update
--   using (
--     public.current_role() = 'DELIVERY'
--     and delivery_person_id = public.current_profile_id()
--   )
--   with check (delivery_person_id = public.current_profile_id());
--   -- orders_insert_own_customer (20260823172245):
--   create policy "orders_insert_own_customer"
--   on public.orders for insert
--   with check (customer_id = public.current_profile_id());
--   -- order_items_insert_own_order (20260828045436):
--   create policy "order_items_insert_own_order"
--   on public.order_items for insert
--   with check (order_id in (select public.current_customer_order_ids()));
-- ============================================================================
begin;

revoke insert, update, delete on public.deliveries from authenticated;
revoke update, delete on public.orders from authenticated;
revoke insert on public.orders from authenticated;
revoke insert on public.order_items from authenticated;

-- Policies de escritura inertes tras los revokes: fuera, para que nadie
-- vuelva a confiar en ellas.
drop policy if exists "deliveries_insert_delivery_self"   on public.deliveries;
drop policy if exists "deliveries_update_delivery_self"   on public.deliveries;
drop policy if exists "orders_update_delivery_assigned"   on public.orders;
drop policy if exists "orders_update_own_customer_cancel" on public.orders;
drop policy if exists "orders_insert_own_customer"        on public.orders;
drop policy if exists "order_items_insert_own_order"      on public.order_items;

commit;
