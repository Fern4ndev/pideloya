-- ============================================================================
-- PideloYa — Realtime para las listas de pendientes del panel admin
-- ============================================================================
-- RealtimeRefresh (components/ui/realtime-refresh.tsx) usa Postgres
-- Changes, que SOLO emite eventos de tablas incluidas en la publicación
-- supabase_realtime. Hasta hoy estaban orders y deliveries; el plan de
-- mejoras del panel (Fase 10) necesita también:
--
--   - restaurants: /admin/restaurantes refresca solo cuando llega un
--     INSERT (alta nueva). Con filtro is_approved=eq.false server-side,
--     un toggle de is_open o una edición no dispara refresh.
--   - profiles: /admin/repartidores refresca cuando se registra un
--     repartidor nuevo (INSERT con role=DELIVERY; los INSERT de clientes
--     no disparan nada en esta página).
--
-- ¿Por qué un bloque DO? add_table_to_publication lanza error si la
-- tabla ya está en la publicación, y esta migración debe poder
-- re-aplicarse (entornos de staging donde ya se corrió a mano).
-- ============================================================================

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'restaurants'
  ) then
    alter publication supabase_realtime add table public.restaurants;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'profiles'
  ) then
    alter publication supabase_realtime add table public.profiles;
  end if;
end
$$;

-- REPLICA IDENTITY DEFAULT (el default de Postgres) basta: el filtro de
-- Postgres Changes para INSERT solo necesita los valores nuevos. No se
-- usa FULL aquí (a diferencia de orders) porque no se necesitan los
-- valores viejos en payload.old para estas listas.
