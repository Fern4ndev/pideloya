# Decisions and Learnings — PideloYa

Memoria viva del proyecto: una entrada por decisión concreta, con el "por qué" y no solo el "qué". Si una decisión cambia, se agrega una nueva entrada (no se borra la anterior) para conservar el razonamiento histórico.

## 2026-09-25/26 — Manejo de eliminación de cuentas (Fases 1–5 del plan)

Fuente: `plan-manejo-eliminacion-cuentas.md`. Orden de ejecución real: **2 → 1 → 3 → 4 → 5** (la Fase 2 iba primero por ser el único bug con impacto en usuarios reales: pedidos colgados).

### Fase 2 — Pedidos nunca quedan colgados (implementada primero)

- **Desactivar un repartidor con entrega en curso se BLOQUEA** (`deactivateUser` en `lib/actions/admin.ts`, helper `lib/admin/delivery-lifecycle.ts`): el pedido quedaría en tracking eterno para el cliente e inasignable para otros (con `delivery_person_id = null` no vuelve al pool). El error se lanza como `Error` (no `{ success: false }`) porque `ConfirmDialog` ya muestra `err.message` como toast de error; un `success: false` se mostraría como toast verde de éxito.
- **Eliminar un repartidor libera sus pedidos activos ANTES del `auth.admin.deleteUser()`** (`releaseActiveDeliveries`): el borrado de auth aplica `ON DELETE SET NULL` en `deliveries.delivery_person_id` (migración 20260923100000) y sin liberación el pedido quedaría huérfano sin persona para siempre. Devolverlo a `PENDING` lo hace visible de nuevo en `/repartidor/disponibles` (el realtime de `orders` ya invalida esa lista). Cubre también colgados legacy de desactivaciones anteriores.
- **Orden crítico en `releaseActiveDeliveries`:** primero se borra la fila de `deliveries` y después se devuelve el pedido a `PENDING`. Al revés, otro repartidor podría aceptar entre ambas operaciones y chocar con el `UNIQUE(order_id)` de `deliveries`.
- **Eliminar/desactivar un restaurante cancela sus pedidos `PENDING`** (`removeRestaurant`, branch soft-delete): un `PENDING` nunca tiene fila en `deliveries`, así que no hay nada más que limpiar. Los `ASSIGNED/PICKED_UP/ON_THE_WAY` **no** se auto-cancelan (entregas ya en camino): caso conocido para revisión manual del admin.
- `deactivateUser`/`deleteUser` traen el perfil (rol) ANTES de actuar: los guardas solo aplican a `DELIVERY`; clientes/restaurantes quedan intactos.

### Fase 1 — Snapshot del cliente en `orders`

- **`orders.customer_name` / `orders.customer_phone`** (migración 20260926000000 + backfill desde `profiles`): `order_items` ya congelaba `product_name/restaurant_name/image_url/unit_price`, pero `orders` no congelaba nada del cliente; al purgar un perfil (`customer_id` → SET NULL, 20260923130100) el historial perdía para siempre quién hizo el pedido. Ambos writes (`createOrder` en `lib/actions/orders.ts` y `POST /api/v1/orders`) llenan el snapshot al crear.
- **El snapshot NO se anonimiza** al eliminar la cuenta: es dato histórico "al momento del pedido" (igual que `product_name`), no dato vivo del perfil. La anonimización de PII viva vive en `profiles`/`addresses`.
- Pedidos cuyo cliente ya fue borrado antes del backfill quedan sin snapshot (no existe fuente); las lecturas usan el join a `profiles` como fallback (ver `RecentOrdersTable`).
- `types/database.ts` se editó a mano (agregar columnas a Row/Insert/Update): regenerarlo con `supabase gen types` es válido pero requiere la migración aplicada a la base de referencia.

### Fase 3 — Política unificada de hard-delete vs. soft-delete

- **Regla única para todos los roles:** con historial transaccional (`hasTransactionalHistory`: ≥1 pedido para CUSTOMER, ≥1 fila en `deliveries` para DELIVERY) la cuenta **NUNCA se purga de `auth.users`**; se anonimiza + desactiva + se revoca el login. Sin historial: hard-delete completo (comportamiento legacy, sin regresión).
- **Anonimización** (`lib/admin/anonymize-profile.ts`): limpia `full_name/phone/email/document_*` en `profiles` y `address_text/reference` en `addresses`. Las filas de direcciones NO se borran: `orders.address_id` sigue apuntando a una fila válida (y lat/lng se conservan: no identifican por sí solas).
- **Revocación de login sin borrar auth.users:** `ban_duration: '876000h'` (ban permanente de GoTrue, ~100 años). Elección documentada porque el comportamiento exacto de `ban_duration` puede variar entre versiones del SDK; si un día hay que "revivir" una cuenta, se levanta el ban con `ban_duration: 'none'` y la fila conserva su identidad.
- **Flags calculados server-side en batch (cero N+1):** `hasOrders`/`hasDeliveries` se resuelven con un solo query `IN (ids de la página)` desde las páginas de admin, no con una llamada por fila. Se consulta con service role porque el cruce RLS (un admin no ve pedidos de otros clientes vía policies de orders) daría falsos negativos.
- **La UI anuncia la acción real antes de confirmar:** `UserRowActions` muestra "Eliminar" (sin historial) o "Desactivar y anonimizar" (con historial) según el flag del server component. Evita la expectativa incorrecta de que una cuenta con pedidos se borra de verdad.
- Nota: el chequeo cubre `CUSTOMER`/`DELIVERY`. Un hipotético perfil `RESTAURANT`/`ADMIN` con historial pasado a `deleteUser` hoy caería al branch de hard-delete; si alguna vez se elimina un restaurante vía perfil (hoy no existe esa ruta), revisar este punto.

### Fase 4 — Sin huérfanos de ImageKit

- **El hard-delete de un restaurante borra su logo y las imágenes de sus productos de ImageKit** (`removeRestaurant`): el `ON DELETE CASCADE` purga filas de BD pero nunca toca ImageKit — sin esto, cada restaurante eliminado dejaba archivos huérfanos para siempre (costo de almacenamiento).
- **Orden deliberado: recolectar fileIds → borrar imágenes → borrar filas.** Si el borrado de BD falla después, a lo sumo queda un restaurante sin imágenes (recuperable); al revés, quedarían filas borradas con fileIds perdidos e imágenes huérfanas irrecuperables.
- **Soft-delete NO toca imágenes:** el restaurante desactivado conserva logo/productos por si se reactiva.
- `deleteProduct()` ya borraba su imagen correctamente (auditado, sin cambios). No existe foto de perfil de repartidor en el esquema actual — cuando se agregue, recordar borrarla aquí.

### Fase 5 — Privacidad alineada con el código

- **La sección 6 de la Política de Privacidad** (`app/(public)/privacidad/page.tsx`) ahora describe el comportamiento real: con historial → anonimización + pérdida de acceso permanente + conservación de la transacción **por 5 años** (plazo contable/tributario SUNAT); sin pedidos → borrado completo; los pedidos conservan nombre/teléfono "al momento del pedido" como comprobante.
- **El plazo de 5 años es provisional hasta confirmación del contador** del proyecto (prescripción tributaria general y conservación de libros/registros). Si el contador fija otro plazo, es un cambio de una palabra en la página.

### Lecciones transversales

- Server actions que fallan deben **lanzar `Error`** (no devolver `success: false`): el patrón de UI existente solo muestra toasts de error con excepciones.
- Antes de escribir guardas de negocio, revisar si ya existe una query equivalente validada (la de entregas activas del route `accept` se reutilizó tal cual en `delivery-lifecycle.ts`).
- Toda guarda de este plan vive en helpers de `lib/admin/*` compartidos entre server actions y rutas API: una sola implementación, dos puntos de entrada.
