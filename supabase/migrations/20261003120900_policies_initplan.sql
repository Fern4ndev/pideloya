-- ============================================================================
-- PideloYa — Policies hot-path con initPlan (Fase 3.5 del plan de optimización)
-- ============================================================================
-- Motivo:
--   `public.current_role() = 'X'` en el USING de una policy se evalúa POR FILA
--   (Postgres no puede convertir una llamada a función en un plan único). Con
--   `(select public.current_role()) = 'X'` el planner la convierte en un
--   InitPlan: UNA evaluación por consulta, sin importar las filas. Igual para
--   current_profile_id()/auth.uid().
--
--   Alcance DELIBERADO: solo las policies SELECT de las tablas con muchas filas
--   y consultas por render (orders, deliveries, order_items, addresses,
--   products, profiles-select-admin). Las policies de escritura y las de tablas
--   chicas (categories, restaurant_members, payment_incidents...) quedan igual:
--   su costo por fila es irrelevante y cada reescritura es riesgo. Las policies
--   de UPDATE que la migración contract va a eliminar no se tocan aquí.
--
--   Semántica IDÉNTICA: mismas condiciones, solo el envoltorio (select ...).
--
--   ADVERTENCIA (bug encontrado al aplicar): tres policies de este archivo se
--   escribieron copiando la definición "original" de 20260823172245, no el
--   estado previo real — que eran las versiones con funciones SECURITY DEFINER
--   del fix de recursión 20260828044635. Reconstruir una policy cruzada
--   (orders<->deliveries, addresses->orders/deliveries) con subconsulta directa
--   reintroduce 42P17 "infinite recursion detected". Si tocas policies, copia
--   SIEMPRE el estado previo, no el comentario "original".
--
-- Rollback: recreate cada policy con la forma original (comentada junto a cada
-- una, verbatim del estado anterior).
-- ============================================================================
begin;

-- ----------------------------------------------------------------------------
-- ORDERS (SELECT)
-- ----------------------------------------------------------------------------
-- orders_select_own_customer (original: using (customer_id = public.current_profile_id());)
drop policy if exists "orders_select_own_customer" on public.orders;
create policy "orders_select_own_customer"
on public.orders for select
using (customer_id = (select public.current_profile_id()));

-- orders_select_restaurant_readonly (original: subconsulta con
-- current_restaurant_ids() inline; verbatim en el rollback)
drop policy if exists "orders_select_restaurant_readonly" on public.orders;
create policy "orders_select_restaurant_readonly"
on public.orders for select
using (
  id in (
    select oi.order_id
    from public.order_items oi
    where oi.restaurant_id in (select id from public.current_restaurant_ids() as rid)
  )
);

-- orders_select_delivery (estado previo: la versión de 20260828044635, el fix
-- de recursión orders<->deliveries — NO la original de 20260823172245):
-- using (public.current_role() = 'DELIVERY'
--   and (status = 'PENDING' or id in (select public.current_delivery_order_ids())))
-- OJO: la subconsulta directa a deliveries (forma "original") REINTRODUCE el
-- ciclo con deliveries_select_customer → error 42P17 "infinite recursion
-- detected in policy for relation orders". La consulta cruzada pasa por la
-- función SECURITY DEFINER.
drop policy if exists "orders_select_delivery" on public.orders;
create policy "orders_select_delivery"
on public.orders for select
using (
  (select public.current_role()) = 'DELIVERY'
  and (
    status = 'PENDING'
    or id in (select public.current_delivery_order_ids())
  )
);

-- orders_all_admin (original: using (public.current_role() = 'ADMIN')
-- with check (public.current_role() = 'ADMIN'))
drop policy if exists "orders_all_admin" on public.orders;
create policy "orders_all_admin"
on public.orders for all
using ((select public.current_role()) = 'ADMIN')
with check ((select public.current_role()) = 'ADMIN');

-- ----------------------------------------------------------------------------
-- DELIVERIES (SELECT)
-- ----------------------------------------------------------------------------
-- deliveries_select_customer (estado previo: la versión de 20260828044635, fix
-- de recursión — NO la original con subconsulta directa a orders):
-- using (order_id in (select public.current_customer_order_ids()));
drop policy if exists "deliveries_select_customer" on public.deliveries;
create policy "deliveries_select_customer"
on public.deliveries for select
using (
  order_id in (select public.current_customer_order_ids())
);

-- deliveries_select_delivery (original: using (
--   public.current_role() = 'DELIVERY'
--   and (delivery_person_id is null or delivery_person_id = public.current_profile_id())
-- ))
drop policy if exists "deliveries_select_delivery" on public.deliveries;
create policy "deliveries_select_delivery"
on public.deliveries for select
using (
  (select public.current_role()) = 'DELIVERY'
  and (delivery_person_id is null or delivery_person_id = (select public.current_profile_id()))
);

-- deliveries_all_admin (original: using/check public.current_role() = 'ADMIN')
drop policy if exists "deliveries_all_admin" on public.deliveries;
create policy "deliveries_all_admin"
on public.deliveries for all
using ((select public.current_role()) = 'ADMIN')
with check ((select public.current_role()) = 'ADMIN');

-- ----------------------------------------------------------------------------
-- ORDER_ITEMS (SELECT)
-- ----------------------------------------------------------------------------
-- order_items_select_own_order (original: using (order_id in (select
-- public.current_customer_order_ids()));)
drop policy if exists "order_items_select_own_order" on public.order_items;
create policy "order_items_select_own_order"
on public.order_items for select
using (order_id in (select public.current_customer_order_ids()));

-- order_items_select_restaurant (original: using (restaurant_id in (select
-- public.current_restaurant_ids()));)
drop policy if exists "order_items_select_restaurant" on public.order_items;
create policy "order_items_select_restaurant"
on public.order_items for select
using (restaurant_id in (select id from public.current_restaurant_ids() as rid));

-- order_items_select_delivery (versión de 20261003120500, ahora con initPlan)
-- El "PENDING" pasa por public.pending_order_ids() (SECURITY DEFINER, creada
-- en 120500): una subconsulta directa a orders aquí cerraría el ciclo
-- orders_select_restaurant_readonly -> order_items -> orders (42P17).
drop policy if exists "order_items_select_delivery" on public.order_items;
create policy "order_items_select_delivery"
on public.order_items for select
using (
  (select public.current_role()) = 'DELIVERY'
  and (
    order_id in (select public.current_delivery_order_ids())
    or order_id in (select public.pending_order_ids())
  )
);

-- order_items_all_admin (original: using/check public.current_role() = 'ADMIN')
drop policy if exists "order_items_all_admin" on public.order_items;
create policy "order_items_all_admin"
on public.order_items for all
using ((select public.current_role()) = 'ADMIN')
with check ((select public.current_role()) = 'ADMIN');

-- ----------------------------------------------------------------------------
-- ADDRESSES (SELECT)
-- ----------------------------------------------------------------------------
-- addresses_select_own (original: using (customer_id = public.current_profile_id());)
drop policy if exists "addresses_select_own" on public.addresses;
create policy "addresses_select_own"
on public.addresses for select
using (customer_id = (select public.current_profile_id()));

-- addresses_select_assigned_delivery (estado previo: la versión de
-- 20260828044635, fix de recursión — NO la original con join directo a
-- orders/deliveries):
-- using (public.current_role() = 'DELIVERY'
--   and id in (select public.current_delivery_address_ids()))
drop policy if exists "addresses_select_assigned_delivery" on public.addresses;
create policy "addresses_select_assigned_delivery"
on public.addresses for select
using (
  (select public.current_role()) = 'DELIVERY'
  and id in (select public.current_delivery_address_ids())
);

-- addresses_all_admin (original: using/check public.current_role() = 'ADMIN')
drop policy if exists "addresses_all_admin" on public.addresses;
create policy "addresses_all_admin"
on public.addresses for all
using ((select public.current_role()) = 'ADMIN')
with check ((select public.current_role()) = 'ADMIN');

-- ----------------------------------------------------------------------------
-- PRODUCTS (SELECT — catálogo público caliente)
-- ----------------------------------------------------------------------------
-- products_select_customer (versión de 20260927000100, con initPlan)
drop policy if exists "products_select_customer" on public.products;
create policy "products_select_customer"
on public.products for select
using (
  ((select auth.role()) = 'anon' or (select public.current_role()) in ('CUSTOMER', 'ADMIN'))
  and available = true
  and restaurant_id in (
    select id from public.restaurants where is_approved = true and is_active = true
  )
);

-- products_select_owner (original: using (restaurant_id in (select
-- public.current_restaurant_ids()));)
drop policy if exists "products_select_owner" on public.products;
create policy "products_select_owner"
on public.products for select
using (restaurant_id in (select id from public.current_restaurant_ids() as rid));

-- products_all_admin (original: using/check public.current_role() = 'ADMIN')
drop policy if exists "products_all_admin" on public.products;
create policy "products_all_admin"
on public.products for all
using ((select public.current_role()) = 'ADMIN')
with check ((select public.current_role()) = 'ADMIN');

-- ----------------------------------------------------------------------------
-- PROFILES (SELECT admin — listas de usuarios/repartidores del panel)
-- ----------------------------------------------------------------------------
-- profiles_select_admin (original: using (public.current_role() = 'ADMIN');)
drop policy if exists "profiles_select_admin" on public.profiles;
create policy "profiles_select_admin"
on public.profiles for select
using ((select public.current_role()) = 'ADMIN');

commit;
