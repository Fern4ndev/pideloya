-- ============================================================================
-- PideloYa — is_open del restaurante (señal de "cerrado" para el cliente)
-- ============================================================================
--
-- is_open lo controla SOLO el dueño con el switch Abierto/Cerrado. is_active
-- queda como estado exclusivo del admin (aprobación / desactivación) y sigue
-- controlando la visibilidad pública. Así, cerrar el negocio ya no lo esconde
-- ni cambia nada en el panel de admin: solo informa "Cerrado / No hay atención"
-- en el lado del cliente.

alter table public.restaurants add column is_open boolean not null default true;

comment on column public.restaurants.is_open is
  'Abierto/cerrado controlado por el dueño. No afecta visibilidad ni admin.';

-- Backfill: restaurantes aprobados con is_active=false cuyos perfiles miembro
-- siguen activos fueron cerrados por el DUEÑO (el soft-delete del admin también
-- desactiva los perfiles). Se restauran a visibles con is_open=false, para que
-- aparezcan como "Cerrado" en el cliente sin cambiar la vista del admin.
update public.restaurants r
set is_active = true,
    is_open = false
where r.is_approved = true
  and r.is_active = false
  and exists (
    select 1
    from public.restaurant_members rm
    join public.profiles p on p.id = rm.user_id
    where rm.restaurant_id = r.id
      and p.is_active = true
  );

-- Los horarios de atención no son datos sensibles: se abren a lectura pública
-- (anon + authenticated) para que las páginas del cliente calculen
-- "¿abierto ahora?" sin necesidad de service role. Solo aplica a restaurantes
-- aprobados y activos (visibles para el cliente).
create policy "restaurant_hours_select_public"
on public.restaurant_hours
for select
using (
  exists (
    select 1
    from public.restaurants r
    where r.id = restaurant_id
      and r.is_approved = true
      and r.is_active = true
  )
);