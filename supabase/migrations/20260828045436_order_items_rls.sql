-- ============================================================================
-- PideloYa — RLS faltante: order_items
-- ============================================================================
-- Igual que restaurant_members/categories en su momento, esta tabla se
-- quedó sin RLS habilitado. La cerramos usando las funciones
-- SECURITY DEFINER ya existentes, para no repetir el problema de
-- recursión que ya resolvimos entre orders y deliveries.
-- ============================================================================

alter table public.order_items enable row level security;

-- El cliente puede insertar ítems solo en SUS PROPIOS pedidos.
create policy "order_items_insert_own_order"
on public.order_items for insert
with check (
  order_id in (select public.current_customer_order_ids())
);

-- El cliente puede ver los ítems de sus propios pedidos.
create policy "order_items_select_own_order"
on public.order_items for select
using (
  order_id in (select public.current_customer_order_ids())
);

-- El restaurante puede ver (solo lectura) los ítems de SUS productos.
create policy "order_items_select_restaurant"
on public.order_items for select
using (
  restaurant_id in (select public.current_restaurant_ids())
);

-- El repartidor puede ver los ítems de los pedidos que tiene asignados.
create policy "order_items_select_delivery"
on public.order_items for select
using (
  public.current_role() = 'DELIVERY'
  and order_id in (select public.current_delivery_order_ids())
);

create policy "order_items_all_admin"
on public.order_items for all
using (public.current_role() = 'ADMIN')
with check (public.current_role() = 'ADMIN');