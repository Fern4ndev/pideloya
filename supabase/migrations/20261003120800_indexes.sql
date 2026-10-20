-- ============================================================================
-- PideloYa — Índices (Fase 3.5 del plan de optimización)
-- ============================================================================
-- Motivo:
--   Nuevos: cubren los accesos calientes de las RPCs agregadas y las policies
--     - order_items(restaurant_id, created_at desc): gráficas del restaurante y
--       orders_select_restaurant_readonly (subconsulta por restaurant_id).
--     - payment_incidents(order_id) y (reported_by): joins de la vista de
--       conciliación y del reporte de incidencias.
--     - profiles(role, is_active): admin_counts + listas de repartidores.
--     - orders(status, created_at desc): available orders / contadores por
--       estado ordenados por fecha.
--     - deliveries(delivery_person_id, delivered_at): delivery_stats y
--       gráficas del repartidor.
--
--   Sobran (los UNIQUE ya crean un índice equivalente — duplicado puro):
--     - profiles_auth_id_idx      (auth_id es UNIQUE desde core_tables)
--     - restaurants_slug_idx      (slug es UNIQUE)
--     - addresses_customer_idx    (addresses_one_per_customer UNIQUE, 20260920231812)
--
-- Rollback (comentado, verbatim):
--   create index if not exists profiles_auth_id_idx on public.profiles(auth_id);
--   create index if not exists restaurants_slug_idx on public.restaurants(slug);
--   create index if not exists addresses_customer_idx on public.addresses(customer_id);
--   drop index if exists public.order_items_restaurant_created_idx;
--   drop index if exists public.payment_incidents_order_idx;
--   drop index if exists public.payment_incidents_reported_by_idx;
--   drop index if exists public.profiles_role_active_idx;
--   drop index if exists public.orders_status_created_idx;
--   drop index if exists public.deliveries_person_delivered_idx;
-- ============================================================================
begin;

create index if not exists order_items_restaurant_created_idx
  on public.order_items (restaurant_id, created_at desc);
create index if not exists payment_incidents_order_idx
  on public.payment_incidents (order_id);
create index if not exists payment_incidents_reported_by_idx
  on public.payment_incidents (reported_by);
create index if not exists profiles_role_active_idx
  on public.profiles (role, is_active);
create index if not exists orders_status_created_idx
  on public.orders (status, created_at desc);
create index if not exists deliveries_person_delivered_idx
  on public.deliveries (delivery_person_id, delivered_at);

drop index if exists public.profiles_auth_id_idx;
drop index if exists public.restaurants_slug_idx;
drop index if exists public.addresses_customer_idx;

commit;
