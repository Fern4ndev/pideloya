-- ============================================================================
-- PideloYa — order_items.product_id: ON DELETE SET NULL
-- ============================================================================
-- El FK tenía el default de PostgreSQL (NO ACTION = RESTRICT), lo que
-- impedía eliminar productos que ya aparecieron en un pedido:
--
--   ERROR: update or delete on table "products" violates foreign key
--   constraint "order_items_product_id_fkey"
--
-- Es el mismo bug que ya se arregló para users (20260911000000),
-- deliveries (20260923100000) y orders (20260923130100).
--
-- SET NULL — y no CASCADE — porque el pedido es evidencia histórica y NO
-- debe perder sus ítems: order_items ya guarda snapshots en las columnas
-- product_name, image_url, restaurant_name y unit_price (ver 20260829162152,
-- 20260922160419, 20260923000000 y 20260923120000), pensadas exactamente
-- para este caso ("aunque el restaurante … elimine el producto").
-- Toda la lectura del historial usa product_name, nunca join contra products.
-- ============================================================================

-- product_id pasa a ser nullable (el historial queda con product_id = null)
alter table public.order_items
  alter column product_id drop not null;

alter table public.order_items
  drop constraint if exists order_items_product_id_fkey;

alter table public.order_items
  add constraint order_items_product_id_fkey
    foreign key (product_id)
    references public.products(id)
    on delete set null;
