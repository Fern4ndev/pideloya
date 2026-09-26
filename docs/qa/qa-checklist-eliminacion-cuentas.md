# Checklist manual de QA — Manejo de eliminación de cuentas (Fases 1–5)

Ejecutar antes de cada release que toque estas rutas: `lib/actions/admin.ts`, `lib/admin/*`, `lib/actions/orders.ts`, `app/api/v1/orders/route.ts`, `lib/admin/remove-restaurant.ts`, `supabase/migrations/20260926000000_orders_customer_snapshot.sql`.

**Entorno:** `supabase start` + app en dev, o un proyecto de staging. Necesitas sesión de **ADMIN** y datos de prueba de los tres roles. Marca cada caso solo si ves el resultado esperado en la UI **y** en la base (Table Editor o SQL).

---

## Preparación de datos de prueba

- [ ] **P1.** Cliente A **con** al menos 1 pedido entregado. Cliente B **sin** ningún pedido. Repartidor R1 **con** una entrega completada (fila en `deliveries` con `delivered_at`). Repartidor R2 **sin** entregas. Restaurante X **con** pedidos (al menos uno `PENDING`) y logo + productos con imagen. Restaurante Y **sin** pedidos, con logo y al menos 1 producto con imagen. Segundo repartidor R3 activo (para re-aceptar pedidos liberados).

## Fase 1 — Snapshot de cliente en `orders`

- [ ] **F1.1** Crear un pedido nuevo como Cliente A. En `orders`, la fila nueva tiene `customer_name` y `customer_phone` poblados.
- [ ] **F1.2** Crear un pedido vía API (`POST /api/v1/orders` con Bearer token del cliente): el snapshot también queda poblado (verifica que la ruta API no quedó atrás).
- [ ] **F1.3** Backfill: pedidos anteriores a la migración tienen `customer_name` (correr la migración y verificar `select count(*) from orders where customer_name is null and customer_id is not null` = 0).
- [ ] **F1.4** En `/admin` (Pedidos recientes), el nombre del cliente se muestra tomado del snapshot.
- [ ] **F1.5** Eliminar al Cliente A (con historial → ver F3.2): sus pedidos siguen mostrando su nombre y teléfono — ni `/admin` ni el historial muestran "—".

## Fase 2 — Pedidos nunca quedan colgados

### Repartidor

- [ ] **F2.1** Asignar un pedido a R1 (aceptarlo como R3 no; como R1) y dejarlo en `ASSIGNED`. Intentar **desactivar** a R1 desde `/admin/repartidores`: la acción se BLOQUEA con el mensaje "Este repartidor tiene una entrega en curso (pedido #…)" y R1 sigue activo.
- [ ] **F2.2** Desactivar a R2 (sin entregas): funciona igual que siempre, mensaje de éxito.
- [ ] **F2.3** Con el pedido de F2.1 aún `ASSIGNED` a R1, **eliminar** la cuenta de R1 desde la tabla (o mediante un repartidor sin historial simulado): el pedido vuelve a `PENDING` y la fila en `deliveries` desaparece. En `/repartidor/disponibles` (sesión R3) el pedido reaparece sin recargar (realtime).
- [ ] **F2.4** R3 acepta el pedido liberado: pasa a `ASSIGNED` normalmente (sin error de `UNIQUE(order_id)`).

### Restaurante

- [ ] **F2.5** Con el restaurante X teniendo un pedido `PENDING`, eliminar/desactivar X desde `/admin/restaurantes`: el toast reporta "Se cancelaron N pedido(s) pendiente(s)" y los pedidos `PENDING` pasan a `CANCELLED` en la base.
- [ ] **F2.6** El cliente dueño de ese pedido ve el cambio a "Cancelado" en vivo en `/cliente/pedidos/[id]` (canal realtime de `orders`).
- [ ] **F2.7** Los pedidos de X que estaban `ASSIGNED`/en curso (si creaste uno) NO se cancelan automáticamente — quedan para revisión manual (comportamiento acordado).

## Fase 3 — Política hard-delete vs. anonimizar

- [ ] **F3.1** En `/admin/usuarios`, Cliente B (sin pedidos) muestra botón **"Eliminar"** (icono papelera) y el diálogo dice que se elimina por completo. Confirmar: el perfil y su usuario de auth desaparecen (`select * from auth.users where email = 'B'` vacío).
- [ ] **F3.2** Cliente A (con pedidos) muestra botón **"Desactivar y anonimizar"** (icono distinto) y el diálogo aclara que la cuenta NO se elimina. Confirmar:
  - [ ] `profiles`: `full_name = 'Usuario eliminado'`, `phone/email/document_*` en null; `is_active = false`.
  - [ ] `addresses` de A: `address_text = 'Dirección eliminada'`, `reference` null — filas intactas (los pedidos siguen apuntando a una dirección válida).
  - [ ] `auth.users`: la fila de A SIGUE existiendo y queda baneada (intentar login con A → bloqueado).
  - [ ] Los pedidos de A conservan montos, fechas y su snapshot de nombre (F1.5).
- [ ] **F3.3** Repartidor con entregas (R1 si no se eliminó): mismo tratamiento F3.2 al "eliminar" (anonimizado + ban, no borrado).
- [ ] **F3.4** Flags sin N+1 evidente: al cargar `/admin/usuarios` y `/admin/repartidores` no se dispara una query de historial por fila (revisar red/log de PostgREST: debe haber 1 query extra por página, no N).

## Fase 4 — Sin huérfanos de ImageKit

- [ ] **F4.1** Anotar los `fileId` del logo de Y y de las imágenes de sus productos (tabla `restaurants`/`products`, columnas `logo_file_id`/`image_file_id`).
- [ ] **F4.2** Eliminar el restaurante Y (sin pedidos → hard delete). Verificar en la cuenta de ImageKit (dashboard o API `files`): el logo y las imágenes de productos de Y ya NO existen.
- [ ] **F4.3** Desactivar (soft delete) un restaurante con pedidos (X): sus imágenes SIGUEN en ImageKit y las URLs responden (por si se reactiva).
- [ ] **F4.4** Regresión: eliminar un producto desde el panel del restaurante sigue borrando su imagen (comportamiento previo intacto).

## Fase 5 — Privacidad

- [ ] **F5.1** `/privacidad` sección 6 menciona: anonimización de identificación al eliminar cuenta con historial, conservación de la transacción por 5 años (SUNAT) y conservación del nombre "al momento del pedido". La fecha de actualización es la del release.
- [ ] **F5.2** El texto coincide EXACTAMENTE con el comportamiento implementado (F3.2): si cambió el plazo con el contador, actualizar la palabra correspondiente antes del release.

## Cierre

- [ ] **C1.** `pnpm run typecheck` sin errores y `pnpm run lint` sin errores nuevos en los archivos del plan.
- [ ] **C2.** Migración `20260926000000_orders_customer_snapshot.sql` aplicada al entorno (idempotente: puede re-ejecutarse con `add column if not exists`).
- [ ] **C3.** Ningún pedido quedó en `ASSIGNED/PICKED_UP/ON_THE_WAY` con `delivery_person_id = null` de forma persistente (verificación SQL global al final de la sesión de QA).
