-- ============================================================================
-- PideloYa — Snapshot del cliente en orders
-- ============================================================================
-- order_items ya congela product_name, restaurant_name, image_url,
-- unit_price: son "al momento del pedido". orders no congelaba nada del
-- cliente, así que al eliminar un perfil (orders_customer_id → SET NULL,
-- migración 20260923130100) el historial perdía para siempre el nombre
-- y teléfono de quien hizo el pedido.
--
-- customer_name / customer_phone son snapshot HISTÓRICO intencional
-- (igual que product_name): NO son dato "vivo" del perfil. No se
-- anonimizan al eliminar la cuenta — la anonimización de PII viva vive
-- en profiles/addresses (ver plan de eliminación de cuentas, Fase 5).
--
-- Backfill: rellena pedidos existentes desde profiles. Corre con service
-- role (migraciones), RLS no aplica. Pedidos cuyo cliente ya fue borrado
-- (customer_id null) quedan sin snapshot: para esos no existe fuente.
-- Mismo patrón que 20260923120000_backfill_order_items_snapshots.sql.
-- ============================================================================

alter table public.orders add column if not exists customer_name text;
alter table public.orders add column if not exists customer_phone text;

update public.orders o
set customer_name = p.full_name,
    customer_phone = p.phone
from public.profiles p
where o.customer_id = p.id
  and o.customer_name is null;
