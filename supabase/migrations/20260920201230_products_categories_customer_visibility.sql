-- supabase/migrations/20260920100000_products_categories_customer_visibility.sql

-- ============================================================================
-- PideloYa — Fix: los clientes autenticados no podían ver el menú
-- ============================================================================
-- La migración 20260912000000_fix_rls_products_categories.sql restringió
-- "products_select_public" y "categories_select_public" a `auth.role() =
-- 'anon'`, para que un restaurante autenticado no viera productos ajenos
-- a través de esa policy pensada para visitantes sin sesión. Efecto
-- colateral no buscado: un CLIENTE autenticado (rol CUSTOMER) tampoco
-- tenía ninguna policy que le permitiera leer productos/categorías de
-- OTROS restaurantes — ni la nueva home del cliente ni la carta pública
-- de /(public)/restaurantes/[slug] pueden mostrar nada una vez el
-- cliente inicia sesión.
--
-- Esta migración agrega una policy adicional, específica para clientes
-- (y cualquier otro rol de lectura pública), que replica la misma regla
-- de negocio de "restaurants_select_public": solo productos disponibles
-- de restaurantes aprobados y activos. Las policies de RLS se combinan
-- con OR, así que esto no relaja el acceso ya existente de dueños/admin.
-- ============================================================================

create policy "products_select_customer"
on public.products for select
using (
  available = true
  and restaurant_id in (
    select id from public.restaurants where is_approved = true and is_active = true
  )
);

create policy "categories_select_customer"
on public.categories for select
using (
  restaurant_id in (
    select id from public.restaurants where is_approved = true and is_active = true
  )
);