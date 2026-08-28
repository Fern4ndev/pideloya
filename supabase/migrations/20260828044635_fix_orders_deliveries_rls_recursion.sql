-- ============================================================================
-- PideloYa — Corrige recursión infinita en RLS (orders <-> deliveries)
-- ============================================================================
-- Problema: "orders_select_delivery" consultaba deliveries, y
-- "deliveries_select_customer" consultaba orders. Al evaluar RLS de una,
-- Postgres necesita evaluar la RLS de la otra, que vuelve a necesitar la
-- primera — recursión infinita (error 42P17).
--
-- Solución: las consultas cruzadas pasan por funciones SECURITY DEFINER,
-- que no vuelven a disparar RLS en cascada sobre la tabla consultada.
-- ============================================================================

-- Pedidos asignados al repartidor actual (para políticas de "orders")
create or replace function public.current_delivery_order_ids()
returns setof uuid
language sql
security definer
set search_path = public
stable
as $$
  select order_id
  from public.deliveries
  where delivery_person_id = public.current_profile_id()
$$;

-- Pedidos del cliente actual (para políticas de "deliveries")
create or replace function public.current_customer_order_ids()
returns setof uuid
language sql
security definer
set search_path = public
stable
as $$
  select id
  from public.orders
  where customer_id = public.current_profile_id()
$$;

-- Direcciones de entrega de los pedidos asignados al repartidor actual
-- (para la política de "addresses" que disparó el error original)
create or replace function public.current_delivery_address_ids()
returns setof uuid
language sql
security definer
set search_path = public
stable
as $$
  select o.address_id
  from public.orders o
  where o.id in (select public.current_delivery_order_ids())
$$;

-- ----------------------------------------------------------------------------
-- Reemplaza las policies que causaban el ciclo, usando las funciones de arriba
-- en vez de subconsultas directas contra la otra tabla.
-- ----------------------------------------------------------------------------

drop policy if exists "orders_select_delivery" on public.orders;
create policy "orders_select_delivery"
on public.orders for select
using (
  public.current_role() = 'DELIVERY'
  and (
    status = 'PENDING'
    or id in (select public.current_delivery_order_ids())
  )
);

drop policy if exists "orders_update_delivery_assigned" on public.orders;
create policy "orders_update_delivery_assigned"
on public.orders for update
using (
  public.current_role() = 'DELIVERY'
  and id in (select public.current_delivery_order_ids())
)
with check (
  status in ('ASSIGNED', 'PICKED_UP', 'ON_THE_WAY', 'DELIVERED')
);

drop policy if exists "deliveries_select_customer" on public.deliveries;
create policy "deliveries_select_customer"
on public.deliveries for select
using (
  order_id in (select public.current_customer_order_ids())
);

drop policy if exists "addresses_select_assigned_delivery" on public.addresses;
create policy "addresses_select_assigned_delivery"
on public.addresses for select
using (
  public.current_role() = 'DELIVERY'
  and id in (select public.current_delivery_address_ids())
);