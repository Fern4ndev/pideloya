-- ============================================================================
-- PideloYa — Fix: policies públicas de products y categories
-- Limita la visibilidad de productos/categorías a usuarios no autenticados
-- para que los restaurantes autenticados solo vean sus propios datos.
-- ============================================================================

-- PRODUCTS: dropear la policy pública y recrearla con auth.role() = 'anon'
drop policy if exists "products_select_public" on public.products;

create policy "products_select_public"
on public.products for select
using (auth.role() = 'anon' and available = true);

-- CATEGORIES: dropear la policy pública y recrearla con auth.role() = 'anon'
drop policy if exists "categories_select_public" on public.categories;

create policy "categories_select_public"
on public.categories for select
using (
  auth.role() = 'anon'
  and restaurant_id in (
    select id from public.restaurants where is_approved = true and is_active = true
  )
);
