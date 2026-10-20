-- ============================================================================
-- PideloYa — Sincroniza profiles.role desde app_metadata en el UPDATE (C3 fix)
-- ============================================================================
-- Motivo (bug encontrado al aplicar 20261003120200 al proyecto remoto):
--   GoTrue (admin createUser) NO incluye `app_metadata` en el INSERT de
--   auth.users: escribe `raw_app_meta_data` en un UPDATE POSTERIOR dentro de
--   la misma petición (verificado con un trigger de diagnóstico: el INSERT vio
--   {"provider":"email","providers":["email"]} y el estado final sí traía
--   {"role":"RESTAURANT", ...}).
--
--   Consecuencia: handle_new_user (AFTER INSERT) nunca veía el rol →
--   registerRestaurant/registerDeliveryPerson creaban perfiles CUSTOMER
--   activos en vez de RESTAURANT/DELIVERY pendientes de aprobación. La suite
--   test-rls.mjs lo maquillaba fijando el rol con service_role después (línea
--   ~193), pero el flujo real de registro no compensaba.
--
--   Fix: el trigger pasa a `after insert or update of raw_app_meta_data` y en
--   el UPDATE sincroniza el rol cuando app_metadata.role cambia:
--     - solo si la clave 'role' existe (GoTrue escribe provider/providers sin
--       rol en búsquedas de OAuth/signup de clientes → no toca el perfil);
--     - solo si difiere del perfil actual (idempotente);
--     - is_active = (rol = 'CUSTOMER'), igual que en el INSERT: un rol
--       no-CUSTOMER queda pendiente de aprobación.
--   Seguridad: la función es SECURITY DEFINER (owner postgres) y el guard
--   20261003120000 permite role/is_active a 'postgres' explícitamente. Ningún
--   usuario final puede escribir app_metadata (solo la clave service_role vía
--   GoTrue admin API), así que la escalada sigue cerrada (C3 intacta).
--
-- Rollback (comentado, verbatim del estado anterior — versión de 20261003120200,
-- solo INSERT):
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
--       (new.raw_app_meta_data ->> 'role')::public.user_role,
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
--   drop trigger if exists on_auth_user_created on auth.users;
--   create trigger on_auth_user_created
--   after insert on auth.users
--   for each row
--   execute function public.handle_new_user();
-- ============================================================================
begin;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  raw_role   text := new.raw_app_meta_data ->> 'role';
  want_role  public.user_role;
  v_profile  uuid;
begin
  if TG_OP = 'INSERT' then
    -- Rol de app_metadata si viene (escritura directa en SQL / si GoTrue
    -- algún día lo incluye en el INSERT); si no, CUSTOMER.
    want_role := coalesce(raw_role::public.user_role, 'CUSTOMER');
    insert into public.profiles (auth_id, role, full_name, is_active, email)
    values (
      new.id,
      want_role,
      coalesce(new.raw_user_meta_data ->> 'full_name', new.email),
      -- CUSTOMER entra activo de inmediato; RESTAURANT/DELIVERY/ADMIN
      -- quedan pendientes de aprobación del admin.
      case when want_role = 'CUSTOMER' then true else false end,
      new.email
    );
    return new;
  end if;

  -- UPDATE de raw_app_meta_data (el write tardío de GoTrue descrito arriba).
  if raw_role is null then
    return new; -- sin rol explícito: no tocar el perfil
  end if;
  want_role := raw_role::public.user_role;

  update public.profiles
     set role      = want_role,
         is_active = case when want_role = 'CUSTOMER' then true else false end
   where auth_id = new.id
     and role is distinct from want_role;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert or update of raw_app_meta_data on auth.users
for each row
execute function public.handle_new_user();

commit;
