-- ============================================================================
-- PideloYa — Guardas de columnas privilegiadas (C1/H2 del plan de optimización)
-- ============================================================================
-- Motivo:
--   La migración 20260830062645 intentó proteger `profiles(role, is_active)` y
--   `restaurants(is_approved)` con REVOKEs a nivel de COLUMNA. En Postgres un
--   REVOKE (col) solo retira el privilegio de columna: si el rol sigue teniendo
--   el privilegio a nivel de TABLA (Supabase lo concede por defecto a
--   anon/authenticated/service_role en el esquema public), ese privilegio
--   cubre TODAS las columnas y el REVOKE por columna no protege nada.
--   Consecuencia: cualquier usuario autenticado podía, con un PATCH directo a
--   la API, promoverse a ADMIN o auto-aprobar su restaurante (C1) y el dueño
--   podía reactivar su restaurante tras una desactivación del admin (H2).
--
-- Solución: triggers BEFORE UPDATE que rechazan (errcode 42501) cualquier
-- cambio de las columnas privilegiadas cuando quien escribe NO es un contexto
-- de confianza: migraciones (postgres / supabase_admin) o service_role (las
-- Server Actions de admin y registro, vía createServiceRoleClient).
--
-- El dueño sigue pudiendo actualizar el RESTO de columnas (is_open para
-- pausarse, name/description/whatsapp/logo, etc.).
--
-- Actualiza la intención documentada de 20260830062645: is_active de
-- restaurants YA NO queda editable por el dueño a propósito — para pausar el
-- negocio existe is_open (20260924000000) y dejar is_active editable permite
-- al dueño reactivarse tras un soft-delete del admin (hallazgo H2).
--
-- Rollback (comentado, verbatim del estado anterior):
--   drop trigger if exists guard_profile_cols on public.profiles;
--   drop trigger if exists guard_restaurant_cols on public.restaurants;
--   drop function if exists public.guard_profile_privileged_cols();
--   drop function if exists public.guard_restaurant_privileged_cols();
--   -- (los REVOKE por columna de 20260830062645 y 20260923130000 siguen en
--   --  pie y no se tocan)
-- ============================================================================
begin;

create or replace function public.guard_profile_privileged_cols()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- Contextos de confianza: migraciones (db push), supabase_admin (triggers de
  -- auth como handle_new_user / sync_profile_email) y service_role (Server
  -- Actions de admin/registro). Cualquier otra sesión (anon/authenticated vía
  -- PostgREST) no puede cambiar estas columnas.
  if current_user in ('postgres', 'supabase_admin', 'service_role') then
    return new;
  end if;

  if new.role          is distinct from old.role
  or new.is_active     is distinct from old.is_active
  or new.email         is distinct from old.email
  or new.anonymized_at is distinct from old.anonymized_at
  or new.auth_id       is distinct from old.auth_id then
    raise exception 'Columna protegida: role/is_active/email/anonymized_at/auth_id solo pueden cambiar por el administrador'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists guard_profile_cols on public.profiles;
create trigger guard_profile_cols
  before update on public.profiles
  for each row
  execute function public.guard_profile_privileged_cols();

-- restaurants: is_approved e is_active son del admin. El dueño pausa con
-- is_open (20260924000000) — is_active deja de ser suya (H2).
create or replace function public.guard_restaurant_privileged_cols()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user in ('postgres', 'supabase_admin', 'service_role') then
    return new;
  end if;

  if new.is_approved is distinct from old.is_approved
  or new.is_active   is distinct from old.is_active then
    raise exception 'Columna protegida: is_approved/is_active solo pueden cambiar por el administrador'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists guard_restaurant_cols on public.restaurants;
create trigger guard_restaurant_cols
  before update on public.restaurants
  for each row
  execute function public.guard_restaurant_privileged_cols();

commit;
