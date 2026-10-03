-- ============================================================================
-- PideloYa — Eliminar bucket restaurant-logos (plan de optimización, Fase 1.7)
-- ============================================================================
-- Motivo:
--   El bucket `restaurant-logos` (20260912135915) quedó sin uso: los logos se
--   suben a ImageKit (saveRestaurantLogo / ImageUploader). Un bucket público
--   sin uso es superficie de ataque muerta.
--
--   Verificado: ninguna referencia a 'restaurant-logos' en app/ lib/ ni
--   components/ (grep exhaustivo antes de escribir esta migración).
--
-- Rollback (comentado, verbatim del estado anterior):
--   insert into storage.buckets (id, name, public)
--   values ('restaurant-logos', 'restaurant-logos', true)
--   on conflict (id) do nothing;
--   create policy "restaurant_logos_insert_own"
--   on storage.objects for insert to authenticated
--   with check (bucket_id = 'restaurant-logos');
--   create policy "restaurant_logos_update_own"
--   on storage.objects for update to authenticated
--   using (bucket_id = 'restaurant-logos');
--   create policy "restaurant_logos_delete_own"
--   on storage.objects for delete to authenticated
--   using (bucket_id = 'restaurant-logos');
--   create policy "restaurant_logos_admin_all"
--   on storage.objects for all to service_role
--   using (bucket_id = 'restaurant-logos');
-- ============================================================================
begin;

drop policy if exists "restaurant_logos_insert_own" on storage.objects;
drop policy if exists "restaurant_logos_update_own" on storage.objects;
drop policy if exists "restaurant_logos_delete_own" on storage.objects;
drop policy if exists "restaurant_logos_admin_all" on storage.objects;

-- storage.protect_delete (trigger BEFORE DELETE en buckets/objects) rechaza el
-- borrado directo con "Use the Storage API instead" (SQLSTATE 42501). El
-- trigger reconoce el escape hatch `storage.allow_delete_query` — la única vía
-- factible desde una migración SQL (no se puede llamar al endpoint HTTP de la
-- Storage API desde aquí). El bucket está verificado vacío (0 objects), así que
-- la FK objects_bucket_id_fkey no se ve afectada.
set local storage.allow_delete_query = 'true';
delete from storage.buckets where id = 'restaurant-logos';

commit;
