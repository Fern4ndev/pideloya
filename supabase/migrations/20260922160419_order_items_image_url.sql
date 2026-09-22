-- ============================================================================
-- PideloYa — Snapshot de la imagen del producto en order_items
-- ============================================================================
-- Igual que con product_name (20260829162152), guardamos la imagen del
-- producto al momento del pedido. Así el historial del cliente muestra
-- la foto correcta aunque el restaurante luego la cambie, desactive o
-- elimine el producto (lo que además rompería un join contra `products`,
-- filtrado por RLS a available = true).
-- ============================================================================

alter table public.order_items
  add column if not exists image_url text;