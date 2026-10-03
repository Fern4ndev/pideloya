-- ============================================================================
-- PideloYa — Rol desde app_metadata (C3 del plan de optimización)
-- ============================================================================
-- Motivo:
--   handle_new_user leía el rol de `raw_user_meta_data`, que CUALQUIERA
--   controla: `supabase.auth.signUp({ options: { data: { role: 'ADMIN' } } })`
--   creaba un perfil ADMIN. Con esta versión el rol solo se lee de
--   `raw_app_meta_data`, que solo puede escribir el servidor con la clave
--   service_role (registration.ts manda `app_metadata: { role }`).
--
--   Un auto-registro vía /auth/v1/signup sin app_metadata produce CUSTOMER
--   (sin escalada). full_name sigue viniendo de user_metadata: es un dato
--   de presentación propio y no concede privilegios.
--
-- Rollback (comentado, verbatim del estado anterior — versión de
-- 20260923130000 que lee raw_user_meta_data):
--   create or replace function public.handle_new_user()
--   returns trigger
--   language plpgsql
--   security definer
--   set search_path = public
--   as $$
--   declare
--     requested_role public.user_role;
--   begin
--     requested_role := coalesce(
--       (new.raw_user_meta_data ->> 'role')::public.user_role,
--       'CUSTOMER'
--     );
--     insert into public.profiles (auth_id, role, full_name, is_active, email)
--     values (
--       new.id,
--       requested_role,
--       coalesce(new.raw_user_meta_data ->> 'full_name', new.email),
--       case when requested_role = 'CUSTOMER' then true else false end,
--       new.email
--     );
--     return new;
--   end;
--   $$;
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
  -- SOLO app_metadata: user_metadata es controlable por el cliente (C3).
  -- Sin app_metadata (auto-registro de clientes vía /auth/v1/signup) el rol
  -- es CUSTOMER, que es el único rol auto-servicio del producto.
  requested_role := coalesce(
    (new.raw_app_meta_data ->> 'role')::public.user_role,
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
