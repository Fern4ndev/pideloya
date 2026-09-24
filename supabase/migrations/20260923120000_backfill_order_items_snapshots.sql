-- ============================================================================
-- PideloYa — Backfill de snapshots en order_items
-- ============================================================================
-- Las migraciones que agregaron product_name (20260829162152), image_url
-- (20260922160419) y restaurant_name (20260923000000) solo hicieron
-- ADD COLUMN: las filas existentes quedaron en NULL y el historial del
-- repartidor/cliente mostraba "—" o "Producto" para pedidos antiguos.
--
-- Esta migración rellena los snapshots desde las tablas fuente. Corre con
-- service role (migraciones), así que el RLS no aplica y puede leer
-- restaurantes/productos desactivados.
-- ============================================================================

-- restaurant_name ← restaurants.name
UPDATE public.order_items oi
SET restaurant_name = r.name
FROM public.restaurants r
WHERE oi.restaurant_id = r.id
  AND oi.restaurant_name IS NULL;

-- product_name ← products.name
UPDATE public.order_items oi
SET product_name = p.name
FROM public.products p
WHERE oi.product_id = p.id
  AND oi.product_name IS NULL;

-- image_url ← products.image_url
UPDATE public.order_items oi
SET image_url = p.image_url
FROM public.products p
WHERE oi.product_id = p.id
  AND oi.image_url IS NULL
  AND p.image_url IS NOT NULL;
