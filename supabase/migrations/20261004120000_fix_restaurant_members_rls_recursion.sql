-- ============================================================================
-- PideloYa — Fix RLS recursion on restaurant_members (política select_own)
-- ============================================================================
-- Problema: la política "restaurant_members_select_own" llama a
-- current_restaurant_ids(), que a su vez consulta restaurant_members →
-- recursión infinita (42P17) o resultados vacíos. Esto rompe getMyRestaurantId()
-- y hace que el panel de restaurante no encuentre el restaurant_id del usuario.
--
-- Solución: cambiar la política para filtrar directamente por user_id usando
-- current_profile_id() (consulta a tabla profiles, distinta, sin recursión).
-- La función current_restaurant_ids() sigue sirviendo a otras tablas (products,
-- categories, restaurant_hours...) que sí son tablas distintas.
-- ============================================================================
begin;

drop policy if exists "restaurant_members_select_own" on public.restaurant_members;
create policy "restaurant_members_select_own"
on public.restaurant_members for select
using (user_id = (select public.current_profile_id()));

commit;