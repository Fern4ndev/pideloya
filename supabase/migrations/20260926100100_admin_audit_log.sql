-- ============================================================================
-- PideloYa — Tabla de auditoría administrativa (admin_audit_log)
-- ============================================================================
-- Las acciones administrativas (aprobar, desactivar, anonimizar, editar,
-- eliminar) usan service_role y saltan RLS. Sin esta tabla no queda
-- registro de QUIÉN ejecutó la acción ni CUÁNDO, más allá del estado
-- final de la fila. Ante un reclamo de un usuario ("¿por qué me
-- desactivaron?") o una auditoría de cumplimiento, no hay forma de
-- responder con evidencia.
--
-- Escritura: EXCLUSIVAMENTE vía service_role desde las server actions
-- (lib/admin/audit-log.ts → logAdminAction), mismo patrón que el resto
-- de escrituras administrativas. Por eso no existe policy de insert
-- para 'authenticated': nadie escribe por su propia sesión.
--
-- Lectura: solo ADMIN (policy RLS de abajo). El log es una herramienta
-- de supervisión, no un dato personal del usuario auditado: no hay
-- policy de "propio registro" ni nada parecido.
-- ============================================================================

create table public.admin_audit_log (
  id                uuid primary key default gen_random_uuid(),
  actor_profile_id  uuid references public.profiles(id) on delete set null,
  action            text not null,         -- 'approve_restaurant' | 'deactivate_user' | 'delete_user' | 'edit_restaurant' | ...
  target_table      text not null,         -- 'restaurants' | 'profiles' | ...
  target_id         uuid,                  -- NULL en entradas de LOTE: los ids afectados van en metadata.batchIds
  metadata          jsonb,                 -- valores previos, razón, resultado (soft/hard delete), batchIds, etc.
  created_at        timestamptz not null default now()
);

comment on table public.admin_audit_log is
  'Bitácora append-only de acciones administrativas. Escrita solo con service_role desde lib/actions/admin.ts vía logAdminAction(). actor_profile_id es SET NULL: si el admin es eliminado después, el log sobrevive. En acciones en lote, target_id es NULL y metadata.batchIds lista los ids afectados (UNA fila por lote, no N).';

comment on column public.admin_audit_log.target_id is
  'Fila afectada. NULL en acciones en lote: los ids van en metadata.batchIds (una sola entrada de auditoría por lote).';
--   - por objetivo (ver historial de una fila concreta)
--   - por actor (¿qué hizo este admin?)
--   - por fecha (ventana temporal, índice DESC para el listado default)
-- Índice parcial: las entradas de lote (target_id NULL) no aportan
-- búsquedas por objetivo.
create index admin_audit_log_target_idx
  on public.admin_audit_log(target_table, target_id)
  where target_id is not null;
create index admin_audit_log_actor_idx
  on public.admin_audit_log(actor_profile_id);
create index admin_audit_log_created_idx
  on public.admin_audit_log(created_at desc);

alter table public.admin_audit_log enable row level security;

-- Solo el admin puede leer el log; nadie más, ni siquiera vía policy de
-- "propio registro" (el log es una herramienta de supervisión, no un dato
-- personal del usuario auditado). Usa current_role(), la función
-- security definer ya definida en la migración de RLS base.
create policy "admin_audit_log_select_admin"
on public.admin_audit_log for select
using (public.current_role() = 'ADMIN');

-- Sin policies de insert/update/delete para 'authenticated': el servicio
-- de la app escribe con service_role (bypassa RLS) y nadie más debe poder
-- tocar el log. Si el admin borra una fila por su sesión fallaría aquí —
-- comportamiento deseado (log append-only).
