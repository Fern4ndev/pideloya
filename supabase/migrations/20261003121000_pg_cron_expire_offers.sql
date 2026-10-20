-- ============================================================================
-- PideloYa — Programar expiración de ofertas (H6, Fase 3.4)
-- ============================================================================
-- Motivo:
--   expire_stale_delivery_offers (20260928100400) existe desde hace semanas
--   pero NADA la ejecuta: las ofertas sin pagar quedan para siempre en
--   AWAITING_PAYMENT y el pedido nunca vuelve a PENDING para otro repartidor.
--
--   pg_cron en Supabase: extensión soportada en todos los planes; se instala
--   en el schema `cron`. La primera vez, `create extension` puede requerir
--   que el plan del proyecto la tenga habilitada en el dashboard (Database →
--   Extensions); si falla, esta migración es el único archivo afectado y la
--   alternativa documentada es Vercel Cron → endpoint con CRON_SECRET.
--
--   Los jobs corren como el rol que los programa (postgres aquí), por lo que
--   no dependen del grant a service_role de la función.
--
-- Rollback (comentado, verbatim del estado anterior — sin jobs):
--   select cron.unschedule('expire-stale-offers');
--   select cron.unschedule('prune-cron-history');
--   drop extension if exists pg_cron;
-- ============================================================================
begin;

create extension if not exists pg_cron;

-- Ojo con el dollar-quoting: el bloque DO usa $do$ para no cerrarse con los
-- $$ del SQL programado de cron.schedule (anidado idéntico = syntax error).
do $do$
begin
  if not exists (select 1 from cron.job where jobname = 'expire-stale-offers') then
    perform cron.schedule(
      'expire-stale-offers',
      '*/5 * * * *',
      $$select public.expire_stale_delivery_offers(interval '10 minutes')$$
    );
  end if;
end $do$;

-- El propio cron acumula historial en cron.job_run_details (también consume
-- almacenamiento): limpiar lo viejo a diario.
do $do$
begin
  if not exists (select 1 from cron.job where jobname = 'prune-cron-history') then
    perform cron.schedule(
      'prune-cron-history',
      '0 4 * * *',
      $$delete from cron.job_run_details where end_time < now() - interval '3 days'$$
    );
  end if;
end $do$;

commit;
