-- ============================================================================
-- PideloYa — Portada del restaurante (foto principal de la tarjeta)
-- ============================================================================
-- Réplica del patrón de `logo_file_id` (migración 20260912132932): se guarda
-- el fileId de ImageKit junto a la URL para poder borrar la imagen anterior
-- cuando el restaurante sube una nueva, sin dejar huérfanos en ImageKit.
-- La card muestra `cover_url`; sin portada usa un fallback neutro.
-- `cover_url` no es columna privilegiada: el dueño la actualiza por la misma
-- vía que el logo (Server Action), sin cambios RLS.
-- ============================================================================

alter table public.restaurants
  add column if not exists cover_url text;

alter table public.restaurants
  add column if not exists cover_file_id text;
