-- ============================================================================
-- PideloYa — Búsqueda con pg_trgm (Fase 5.3, adelantada)
-- ============================================================================
-- Motivo:
--   /buscar y los filtros admin usan ilike '%…%' (seq scan). Con pg_trgm + GIN
--   el ILIKE difuso usa índice. Barato de añadir ahora (extensión e índices,
--   cero cambios de código: las queries siguen iguales).
--
-- Rollback (comentado, verbatim del estado anterior):
--   drop index if exists public.restaurants_search_trgm_idx;
--   drop index if exists public.products_search_trgm_idx;
--   drop extension if exists pg_trgm;
-- ============================================================================
begin;

create extension if not exists pg_trgm;

create index if not exists restaurants_search_trgm_idx
  on public.restaurants using gin (name gin_trgm_ops, food_type gin_trgm_ops, address_text gin_trgm_ops);

create index if not exists products_search_trgm_idx
  on public.products using gin (name gin_trgm_ops);

commit;
