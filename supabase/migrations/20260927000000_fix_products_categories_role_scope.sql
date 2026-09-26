-- ============================================================================
-- PideloYa — Fix: products_select_customer / categories_select_customer
-- no debían aplicar al rol RESTAURANT
-- ============================================================================
-- Bug: la migración 20260920201230 agregó estas dos policies para que el
-- CLIENTE autenticado viera el catálogo público, pero no excluyó al rol
-- RESTAURANT. Como las policies de SELECT se combinan con OR, un dueño de
-- restaurante (ya cubierto por products_select_owner/categories_select_owner)
-- terminaba viendo TAMBIÉN el catálogo completo de todos los restaurantes
-- aprobados y activos, incluidos los ajenos.
--
-- Fix: se agrega la condición "public.current_role() is distinct from
-- 'RESTAURANT'" — current_role() ya existe (rls_policies.sql) y es
-- SECURITY DEFINER, así que no dispara recursión ni RLS extra. Devuelve
-- NULL para anon (sin fila en profiles), lo cual "is distinct from" trata
-- como verdadero, así que el catálogo público para anon/cliente sigue
-- funcionando exactamente igual que antes.
--
-- Se crea como migración nueva (no se edita 20260920201230) porque el
-- historial de migraciones ya está aplicado en el proyecto vinculado y es
-- append-only: editarlo generaría drift entre local y remoto.
-- ============================================================================

drop policy if exists "products_select_customer" on public.products;
create policy "products_select_customer"
on public.products for select
using (
  available = true
  and public.current_role() is distinct from 'RESTAURANT'
  and restaurant_id in (
    select id from public.restaurants where is_approved = true and is_active = true
  )
);

drop policy if exists "categories_select_customer" on public.categories;
create policy "categories_select_customer"
on public.categories for select
using (
  public.current_role() is distinct from 'RESTAURANT'
  and restaurant_id in (
    select id from public.restaurants where is_approved = true and is_active = true
  )
);
