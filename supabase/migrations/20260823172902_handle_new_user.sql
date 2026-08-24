-- ============================================================================
-- PideloYa — Auto-creación de profile al registrarse
-- ============================================================================
-- Debe aplicarse DESPUÉS de 0001 (tablas) y 0002 (RLS).
--
-- Cómo se usa el rol:
-- - Cliente (Google OAuth, autoregistro): no manda metadata → default CUSTOMER,
--   is_active = true de inmediato (no necesita aprobación).
-- - Restaurante / Repartidor: el admin los invita con
--     supabase.auth.admin.inviteUserByEmail(email, {
--       data: { role: 'RESTAURANT', full_name: '...' }
--     })
--   El trigger lee ese metadata y crea el profile con is_active = false
--   (pendiente de aprobación) hasta que el admin lo active desde /admin.
-- ============================================================================

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

  insert into public.profiles (auth_id, role, full_name, is_active)
  values (
    new.id,
    requested_role,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.email),
    -- CUSTOMER entra activo de inmediato; RESTAURANT/DELIVERY/ADMIN
    -- quedan pendientes de aprobación del admin.
    case when requested_role = 'CUSTOMER' then true else false end
  );

  return new;
end;
$$;

-- Se dispara cada vez que Supabase Auth crea un usuario nuevo
-- (tanto por Google OAuth como por invitación del admin).
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();