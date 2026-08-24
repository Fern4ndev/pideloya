-- ============================================================================
-- PideloYa — RLS faltante: restaurant_members y categories
-- ============================================================================
-- Estas dos tablas quedaron sin RLS habilitado en la migración 0002.
-- Sin RLS, cualquier usuario autenticado podía leer/escribir estas tablas
-- libremente a través de la API de Supabase. Esta migración cierra ese hueco.
-- ============================================================================

alter table public.restaurant_members enable row level security;

-- Un miembro puede ver quién más administra SU restaurante.
create policy "restaurant_members_select_own"
on public.restaurant_members for select
using (restaurant_id in (select public.current_restaurant_ids()));

create policy "restaurant_members_all_admin"
on public.restaurant_members for all
using (public.current_role() = 'ADMIN')
with check (public.current_role() = 'ADMIN');

-- Nota: el INSERT inicial (vincular al dueño con su restaurante recién
-- invitado) se hace con el service role desde inviteRestaurantOwner —
-- ningún usuario final necesita, ni puede, insertar aquí directamente.


alter table public.categories enable row level security;

create policy "categories_select_public"
on public.categories for select
using (
  restaurant_id in (
    select id from public.restaurants where is_approved = true and is_active = true
  )
);

create policy "categories_select_owner"
on public.categories for select
using (restaurant_id in (select public.current_restaurant_ids()));

create policy "categories_insert_owner"
on public.categories for insert
with check (restaurant_id in (select public.current_restaurant_ids()));

create policy "categories_update_owner"
on public.categories for update
using (restaurant_id in (select public.current_restaurant_ids()))
with check (restaurant_id in (select public.current_restaurant_ids()));

create policy "categories_delete_owner"
on public.categories for delete
using (restaurant_id in (select public.current_restaurant_ids()));

create policy "categories_all_admin"
on public.categories for all
using (public.current_role() = 'ADMIN')
with check (public.current_role() = 'ADMIN');