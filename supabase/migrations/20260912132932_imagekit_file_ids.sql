-- ============================================================================
-- PideloYa — Migración a ImageKit: columnas de fileId
-- ============================================================================
-- Guardamos el fileId (identificador interno de ImageKit) junto a cada
-- URL de imagen. Sin esto, no habría forma de borrar la imagen anterior
-- de ImageKit cuando el restaurante sube una nueva — se acumularían
-- archivos huérfanos para siempre en la cuenta de ImageKit.
-- ============================================================================

alter table public.restaurants
  add column if not exists logo_file_id text;

alter table public.products
  add column if not exists image_file_id text;