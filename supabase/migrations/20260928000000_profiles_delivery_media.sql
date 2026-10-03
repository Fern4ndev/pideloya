-- ============================================================================
-- PideloYa — Foto de perfil y QR de Yape para repartidores
-- ============================================================================
-- Estas columnas viven en `profiles`, NO en `deliveries`: `deliveries`
-- registra el ciclo de vida de UN pedido asignado a un repartidor
-- (accepted_at, picked_up_at, delivered_at); la identidad y los datos
-- propios del repartidor (full_name, phone, document_*, vehicle_type) ya
-- viven en `profiles` — exactamente donde deben ir avatar_url y
-- yape_qr_url.
--
-- Por qué no van en `deliveries`: se duplicarían en cada pedido (la misma
-- foto repetida en cientos de filas) y se perderían al archivar el pedido.
--
-- Mismo patrón que logo_file_id/image_file_id en restaurants/products
-- (migración 20260912132932_imagekit_file_ids.sql): junto a la URL pública
-- se guarda el fileId interno de ImageKit, indispensable para poder
-- borrar el archivo anterior cuando el repartidor sube uno nuevo (ver
-- lib/imagekit-server.ts::deleteImageKitFileSafe) y para limpiar ImageKit
-- al anonimizar la cuenta (lib/admin/anonymize-profile.ts).
--
-- Sin limpieza de fileId, cada reemplazo de foto dejaría un archivo
-- huérfano pagado para siempre en la cuenta de ImageKit.
--
-- Ambas parejas de columnas son NULLABLE y genéricas para cualquier rol
-- (avatar_url podría reutilizarse a futuro para cliente/restaurante); la
-- regla "yape_qr solo tiene sentido para DELIVERY" se aplica en la capa
-- de aplicación (server actions en lib/actions/profile.ts), no como
-- constraint de base de datos — mismo criterio que document_type /
-- vehicle_type, que también son columnas genéricas de `profiles` usadas
-- hoy solo por un rol.
--
-- RLS: no hace falta tocarla. 20260830062645_profile_column_security.sql
-- usa una lista negra (revoke update (role, is_active) ... from
-- authenticated), no una lista blanca: las columnas nuevas quedan
-- editables por el propio usuario bajo la policy `profiles_update_own`
-- ya existente, igual que full_name/phone/document_type/vehicle_type hoy.
--
-- Backfill: ninguno. NULL es exactamente el estado correcto para
-- "todavía no subió nada", y no hay dato previo que migrar.
-- ============================================================================

alter table public.profiles
  add column if not exists avatar_url text,
  add column if not exists avatar_file_id text,
  add column if not exists yape_qr_url text,
  add column if not exists yape_qr_file_id text;

comment on column public.profiles.avatar_url is
  'Foto de perfil (ImageKit). Columna genérica; hoy solo la UI de repartidor la expone.';

comment on column public.profiles.avatar_file_id is
  'fileId de ImageKit de avatar_url — necesario para borrar el archivo anterior al reemplazar, y para limpiarlo al anonimizar la cuenta.';

comment on column public.profiles.yape_qr_url is
  'QR de Yape del repartidor para que el cliente le pague directamente. Opcional, solo rol DELIVERY.';

comment on column public.profiles.yape_qr_file_id is
  'fileId de ImageKit de yape_qr_url — mismo motivo que avatar_file_id.';
