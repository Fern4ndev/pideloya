-- ============================================================================
-- PideloYa — Una sola dirección por cliente
-- ============================================================================
-- Regla de negocio: cada cliente guarda como máximo UNA dirección de
-- entrega. Este constraint es la garantía real ante condiciones de
-- carrera; la Server Action (lib/actions/addresses.ts) ya valida esto
-- antes de insertar, pero un insert concurrente solo queda bloqueado aquí.
-- ============================================================================

alter table public.addresses
  add constraint addresses_one_per_customer unique (customer_id);