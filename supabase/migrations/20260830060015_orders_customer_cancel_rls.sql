-- ============================================================================
-- PideloYa — Permite al cliente cancelar su propio pedido (solo PENDING)
-- ============================================================================
-- Hasta ahora no existía NINGUNA policy de UPDATE para que un cliente
-- tocara sus propios pedidos — ni siquiera para cancelar. Esta la agrega,
-- con dos restricciones a la vez:
--   - "using": solo aplica si el pedido es suyo Y todavía está PENDING
--     (evalúa la fila ANTES del cambio).
--   - "with check": el nuevo valor de status debe ser exactamente
--     CANCELLED (evalúa la fila DESPUÉS del cambio) — así no puede
--     aprovechar este permiso para cambiar otra cosa del pedido.
-- ============================================================================

create policy "orders_update_own_customer_cancel"
on public.orders for update
using (
  customer_id = public.current_profile_id()
  and status = 'PENDING'
)
with check (
  status = 'CANCELLED'
);