-- ============================================================================
-- PideloYa — Campos para el registro público (restaurantes y repartidores)
-- ============================================================================

alter table public.restaurants
  add column if not exists whatsapp text,
  add column if not exists food_type text;

alter table public.profiles
  add column if not exists document_type text,
  add column if not exists document_number text,
  add column if not exists vehicle_type text;