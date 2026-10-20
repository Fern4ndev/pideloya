-- ============================================================================
-- PideloYa — order_items para repartidores + publicación realtime (Fase 2)
-- ============================================================================
-- Motivo (plan de optimización, Fase 2.2/2.4):
--   1) AvailableOrdersClient dejará de pedir /api/v1/orders (que trae TODO con
--      service_role y filtra en JS — hallazgo H3) y leerá `orders` directamente
--      con RLS. Para pintar la tarjeta necesita los ítems del pedido PENDING,
--      pero `order_items_select_delivery` (20260828045436) solo cubre ítems de
--      pedidos YA asignados (current_delivery_order_ids) — en un PENDING no hay
--      fila de deliveries todavía y los ítems no se verían. La API con
--      service_role hoy los muestra (y debe poder verlos: el repartidor decide
--      su tarifa con esa información), así que la policy se extiende a ítems de
--      pedidos PENDING — misma información, ahora con RLS como enforcement.
--
--   2) El dashboard del restaurante deja de escuchar `orders` GLOBAL (cualquier
--      pedido de la plataforma refrescaba su pantalla) y escuchará INSERTs de
--      `order_items` filtrados por SU restaurant_id. Para eso la tabla debe
--      estar en la publicación supabase_realtime (hoy solo orders, deliveries,
--      restaurants y profiles — 20260926100300).
--
-- Rollback (comentado, verbatim del estado anterior):
--   drop policy if exists "order_items_select_delivery" on public.order_items;
--   create policy "order_items_select_delivery"
--   on public.order_items for select
--   using (
--     public.current_role() = 'DELIVERY'
--     and order_id in (select public.current_delivery_order_ids())
--   );
--   alter publication supabase_realtime drop table public.order_items;
--   drop function if exists public.pending_order_ids();
-- ============================================================================
begin;

-- Pedidos PENDING para la policy de abajo. SECURITY DEFINER por la misma razón
-- que el fix 20260828044635: la policy no puede hacer una subconsulta directa
-- a orders, porque orders_select_restaurant_readonly consulta order_items con
-- RLS → cycle order_items -> orders -> order_items → 42P17 "infinite recursion
-- detected". Un solo lado del ciclo con función definer basta para romperlo.
create or replace function public.pending_order_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.orders where status = 'PENDING'
$$;

drop policy if exists "order_items_select_delivery" on public.order_items;
create policy "order_items_select_delivery"
on public.order_items for select
using (
  public.current_role() = 'DELIVERY'
  and (
    order_id in (select public.current_delivery_order_ids())
    or order_id in (select public.pending_order_ids())
  )
);

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'order_items'
  ) then
    alter publication supabase_realtime add table public.order_items;
  end if;
end $$;

commit;
