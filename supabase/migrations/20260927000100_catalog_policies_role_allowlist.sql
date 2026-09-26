-- ============================================================================
-- PideloYa — Catálogo público: allowlist explícita de roles (excluye DELIVERY)
-- ============================================================================
-- Contexto: la migración 20260927000000 corrigió el bug original (el rol
-- RESTAURANT veía el catálogo ajeno) excluyendo únicamente a RESTAURANT. Eso
-- dejaba una "caja abierta": cualquier rol con sesión distinto de RESTAURANT
-- (hoy DELIVERY, y cualquier rol que se agregue en el futuro) seguía viendo
-- TODOS los productos disponibles de TODOS los restaurantes aprobados y
-- activos a través de su propia sesión.
--
-- Esta migración invierte la condición a una allowlist explícita:
--   - anon        → la carta pública sin sesión. Se mantiene explícito aquí
--                   para que esta policy sea autosuficiente y no dependa de
--                   que products_select_public/categories_select_public
--                   sigan existiendo tal como están hoy.
--   - CUSTOMER    → el cliente autenticado (home de cliente y carta pública).
--   - ADMIN       → ya tiene products_all_admin/categories_all_admin, pero se
--                   deja explícito para que el catálogo público no dependa de
--                   esas policies.
--
-- Quedan FUERA: RESTAURANT (ya lo estaba, se conserva) y DELIVERY. Ninguno de
-- los dos necesita el catálogo ajeno en su flujo: el repartidor trabaja con
-- orders/deliveries/addresses asignadas y lee los productos de un pedido desde
-- los snapshots de order_items (product_name + image_url), no desde products.
--
-- Fail closed: una sesión autenticada sin fila en profiles (current_role()
-- devuelve NULL) tampoco entra por aquí — ese estado no existe en el flujo
-- real (registro crea el perfil) y, si ocurriera, es preferible que no vea el
-- catálogo a que lo vea por accidente.
-- ============================================================================

drop policy if exists "products_select_customer" on public.products;
create policy "products_select_customer"
on public.products for select
using (
  (auth.role() = 'anon' or public.current_role() in ('CUSTOMER', 'ADMIN'))
  and available = true
  and restaurant_id in (
    select id from public.restaurants where is_approved = true and is_active = true
  )
);

drop policy if exists "categories_select_customer" on public.categories;
create policy "categories_select_customer"
on public.categories for select
using (
  (auth.role() = 'anon' or public.current_role() in ('CUSTOMER', 'ADMIN'))
  and restaurant_id in (
    select id from public.restaurants where is_approved = true and is_active = true
  )
);
