-- ============================================================================
-- PideloYa — Columna anonymized_at en profiles
-- ============================================================================
-- Se llena cuando el admin anonimiza la cuenta por tener historial
-- transaccional (ver lib/admin/anonymize-profile.ts — Ley 29733).
--
-- ¿Por qué importa? Antes de esta columna, un perfil anonimizado
-- (full_name = 'Usuario eliminado', is_active = false) era visualmente
-- indistinguible de un cliente real desactivado por otra razón, y no
-- quedaba evidencia de CUÁNDO se atendió la solicitud de baja — dato
-- requerido para responder auditorías de cumplimiento.
--
-- NULL = cuenta nunca anonimizada. La escritura (Fase 4 del plan) es
-- idempotente: el helper solo la setea si aún es NULL, de modo que
-- re-anonimizar por error la misma cuenta nunca borra la fecha original.
--
-- Necesaria YA para el filtro "Anonimizados" de /admin/usuarios (Fase 2
-- del plan de mejoras del panel admin).
-- ============================================================================

alter table public.profiles
  add column if not exists anonymized_at timestamptz;

comment on column public.profiles.anonymized_at is
  'Se llena cuando el admin anonimiza la cuenta por tener historial transaccional (ver lib/admin/anonymize-profile.ts). NULL = cuenta nunca anonimizada.';

-- Índice parcial para el filtro "Anonimizados" del panel admin
-- (SELECT ... WHERE anonymized_at IS NOT NULL) y para el conteo exacto.
create index if not exists profiles_anonymized_idx
  on public.profiles(anonymized_at)
  where anonymized_at is not null;
