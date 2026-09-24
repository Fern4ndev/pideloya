-- ============================================================================
-- Fix: ON DELETE SET NULL en deliveries.delivery_person_id
-- ============================================================================
-- Antes era ON DELETE CASCADE (ver 20260911000000): purgar un perfil de
-- repartidor borraba todas sus filas de `deliveries` (historial de entregas
-- = evidencia de trabajo) y dejaba órdenes en estado activo
-- (ASSIGNED/PICKED_UP/ON_THE_WAY) huérfanas sin persona asignada y sin
-- error alguno.
--
-- SET NULL conserva la fila de entrega con sus timestamps
-- (accepted_at / picked_up_at / delivered_at): el pedido mantiene su traza
-- aunque se purgue el perfil. El campo ya era nullable por diseño
-- ("null hasta que alguien lo acepte").
--
-- Nota RLS: deliveries_select_delivery permite ver filas con persona null
-- (son las "disponibles"), pero el flujo de aceptación solo lista órdenes
-- con status PENDING — una entrega histórica con persona null no vuelve a
-- aparecer como disponible.
-- ============================================================================

ALTER TABLE public.deliveries
  DROP CONSTRAINT IF EXISTS deliveries_delivery_person_id_fkey,
  ADD CONSTRAINT deliveries_delivery_person_id_fkey
    FOREIGN KEY (delivery_person_id) REFERENCES public.profiles(id)
    ON DELETE SET NULL;
