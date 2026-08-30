-- ============================================================================
-- PideloYa — Seguridad a nivel de columna para campos sensibles
-- ============================================================================
-- Las policies RLS existentes (profiles_update_own, restaurants_update_owner)
-- validan que la fila sea del usuario, pero Postgres RLS no restringe QUÉ
-- COLUMNAS puede tocar un update — solo filtra filas. Esto significa que,
-- en teoría, un usuario podría intentar actualizar su propio `role` o
-- `is_active`, o un restaurante podría auto-aprobarse (`is_approved`),
-- enviando una petición directa a la API en vez de usar la UI.
--
-- Esta migración cierra eso con privilegios a nivel de columna: el rol
-- "authenticated" (cualquier usuario logueado) ya no puede escribir esas
-- columnas específicas, sin importar qué mande. El "service_role" (el que
-- usan las Server Actions de admin, vía createServiceRoleClient) no se ve
-- afectado — sigue pudiendo aprobar restaurantes y activar cuentas.
-- ============================================================================

revoke update (role, is_active) on public.profiles from authenticated;
revoke update (is_approved) on public.restaurants from authenticated;

-- Nota: is_active de restaurants SÍ queda editable por el dueño a propósito
-- — tiene sentido que un negocio pueda "pausarse" temporalmente por sí
-- mismo (ej. cerrado por hoy), a diferencia de is_approved, que es
-- exclusivamente del admin.