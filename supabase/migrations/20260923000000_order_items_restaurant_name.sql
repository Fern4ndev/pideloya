-- ============================================================================
-- PideloYa — Snapshot del nombre del restaurante en order_items
-- ============================================================================
-- order_items ya guarda unit_price y product_name como "foto" al momento
-- de la compra. Esta migración hace lo mismo con el nombre del restaurante:
-- así el historial de entregas del repartidor y el historial de pedidos del
-- cliente siguen siendo correctos aunque el restaurante después se desactive
-- (is_active = false) y la RLS policy "restaurants_select_public" lo oculte.
-- ============================================================================

alter table public.order_items
  add column if not exists restaurant_name text;