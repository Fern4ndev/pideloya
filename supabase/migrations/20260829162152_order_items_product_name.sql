-- ============================================================================
-- PideloYa — Snapshot del nombre del producto en order_items
-- ============================================================================
-- order_items ya guarda unit_price como una "foto" del precio al momento
-- de la compra (nunca se recalcula con el precio actual). Esta migración
-- hace lo mismo con el nombre: así el historial de pedidos del cliente
-- sigue siendo correcto aunque el restaurante después renombre o
-- desactive el producto — y evita depender de un join contra `products`
-- filtrado por RLS (que solo muestra productos con available=true).
-- ============================================================================

alter table public.order_items
  add column if not exists product_name text;