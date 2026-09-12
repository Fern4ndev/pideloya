-- ============================================================================
-- PideloYa — Storage: logos de restaurantes
-- ============================================================================
-- Bucket público (cualquiera puede VER un logo con su URL), pero solo el
-- dueño del restaurante puede subir/reemplazar/borrar archivos dentro de
-- SU PROPIA carpeta. La convención de carpetas es:
--   restaurant-logos/{restaurant_id}/logo-{timestamp}.{ext}
-- storage.foldername(name)[1] extrae ese {restaurant_id} del path para
-- compararlo contra current_restaurant_ids() — la misma función
-- SECURITY DEFINER que ya usamos en el resto del proyecto.
-- ============================================================================

insert into storage.buckets (id, name, public)
values ('restaurant-logos', 'restaurant-logos', true)
on conflict (id) do nothing;

create policy "restaurant_logos_insert_own"
on storage.objects for insert
with check (
  bucket_id = 'restaurant-logos'
  and (storage.foldername(name))[1]::uuid in (select public.current_restaurant_ids())
);

create policy "restaurant_logos_update_own"
on storage.objects for update
using (
  bucket_id = 'restaurant-logos'
  and (storage.foldername(name))[1]::uuid in (select public.current_restaurant_ids())
);

create policy "restaurant_logos_delete_own"
on storage.objects for delete
using (
  bucket_id = 'restaurant-logos'
  and (storage.foldername(name))[1]::uuid in (select public.current_restaurant_ids())
);

create policy "restaurant_logos_admin_all"
on storage.objects for all
using (bucket_id = 'restaurant-logos' and public.current_role() = 'ADMIN')
with check (bucket_id = 'restaurant-logos' and public.current_role() = 'ADMIN');