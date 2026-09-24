-- ============================================================================
-- PideloYa — Columna email en profiles
-- ============================================================================
-- Los clientes inician sesión con Google y su email vive solo en
-- auth.users. El módulo Admin → Usuarios necesita mostrarlo en la tabla
-- y en el diálogo de inspección, así que lo copiamos a profiles.
--
-- - Backfill desde auth.users para las cuentas existentes.
-- - handle_new_user() se actualiza para insertarlo en cada signup.
-- - Trigger de sync por si Supabase Auth confirma/cambia el email.
-- - El email NO debe ser editable por el usuario vía la tabla profiles
--   (lo maneja Supabase Auth) → se revoca UPDATE a "authenticated".
-- ============================================================================

alter table public.profiles add column email text;

-- Backfill: email de las cuentas existentes
update public.profiles p
set email = u.email
from auth.users u
where p.auth_id = u.id
  and p.email is null
  and u.email is not null;

-- Unicidad (parcial: los NULL no chocan en Postgres)
create unique index profiles_email_key
  on public.profiles (email)
  where email is not null;

-- El usuario no debe editar su email desde profiles (Auth lo controla)
revoke update (email) on public.profiles from authenticated;

-- ----------------------------------------------------------------------------
-- handle_new_user: incluir email en el INSERT del profile
-- ----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_role public.user_role;
begin
  requested_role := coalesce(
    (new.raw_user_meta_data ->> 'role')::public.user_role,
    'CUSTOMER'
  );

  insert into public.profiles (auth_id, role, full_name, is_active, email)
  values (
    new.id,
    requested_role,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.email),
    -- CUSTOMER entra activo de inmediato; RESTAURANT/DELIVERY/ADMIN
    -- quedan pendientes de aprobación del admin.
    case when requested_role = 'CUSTOMER' then true else false end,
    new.email
  );

  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- Sync: si Supabase Auth cambia el email de la cuenta, propagarlo
-- ----------------------------------------------------------------------------
create or replace function public.sync_profile_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email is distinct from old.email then
    update public.profiles
    set email = new.email
    where auth_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_email_changed on auth.users;
create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row
  when (old.email is distinct from new.email)
  execute function public.sync_profile_email();
