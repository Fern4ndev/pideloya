# Plan de Implementación — Manejo de Eliminación de Clientes, Restaurantes y Repartidores

**Proyecto:** PideloYa
**Objetivo:** Cerrar las brechas identificadas en el manejo de historial transaccional al eliminar/desactivar cuentas de Cliente, Restaurante y Repartidor, sin romper la integridad de pedidos pasados ni dejar datos huérfanos.

---

## Índice de fases

| Fase | Nombre | Prioridad | Impacto |
|---|---|---|---|
| 1 | Snapshot simétrico de cliente en `orders` | Alta | Corrige pérdida de trazabilidad ya ocurriendo |
| 2 | Liberación/cancelación automática de pedidos activos | Crítica | Bug funcional visible al usuario final |
| 3 | Política unificada de hard-delete vs. soft-delete | Alta | Consistencia y seguridad de datos |
| 4 | Limpieza de archivos huérfanos en ImageKit | Media | Fuga de almacenamiento/costos |
| 5 | Anonimización de PII vs. conservación de evidencia | Media-Alta | Cumplimiento Ley 29733 |
| 6 | Documentación y guardas de regresión | Baja (pero obligatoria al cierre) | Mantenibilidad futura |

Orden recomendado de ejecución: **2 → 1 → 3 → 4 → 5 → 6**. La Fase 2 se prioriza primero porque es el único punto que afecta a usuarios reales en producción ahora mismo (pedidos "colgados"); las demás son estructurales y no urgen en el mismo orden en que se descubrieron.

---

## Fase 1 — Snapshot de datos del cliente en `orders`

**Por qué:** `order_items` ya congela `product_name`, `restaurant_name`, `image_url`, `unit_price`. `orders` no congela nada del cliente, así que al borrar un perfil (`customer_id = null`), el historial pierde para siempre el nombre de quien hizo el pedido.

### Tareas

1. **Migración SQL** `supabase/migrations/<timestamp>_orders_customer_snapshot.sql`
   - `alter table public.orders add column if not exists customer_name text;`
   - `alter table public.orders add column if not exists customer_phone text;`
   - Backfill desde `profiles` para pedidos existentes (igual patrón que `20260923120000_backfill_order_items_snapshots.sql`):
     ```sql
     update public.orders o
     set customer_name = p.full_name,
         customer_phone = p.phone
     from public.profiles p
     where o.customer_id = p.id
       and o.customer_name is null;
     ```

2. **Actualizar `lib/actions/orders.ts` → `createOrder()`**
   - Al insertar en `orders`, incluir `customer_name: profile.full_name` y `customer_phone: profile.phone` (traer esos campos en el `select` del perfil, hoy solo trae `id`).

3. **Actualizar `app/api/v1/orders/route.ts` → `POST`**
   - Mismo cambio: la API tiene su propia lógica de creación de pedido duplicada — traer `full_name`/`phone` del contexto autenticado o de `profiles` antes del insert.

4. **Actualizar `types/database.ts`**
   - Agregar `customer_name` y `customer_phone` a `Row`/`Insert`/`Update` de la tabla `orders` (regenerar tipos si usas `supabase gen types`, o editar a mano).

5. **Actualizar lecturas que hoy dependen del join a `profiles`**
   - `components/features/admin/RecentOrdersTable.tsx`: reemplazar `profiles:customer_id (full_name)` por `order.customer_name` directamente (con fallback a join solo si `customer_name` es null, para pedidos viejísimos sin backfill).
   - Revisar si `RestaurantOrdersTable` o el detalle de pedido de repartidor necesitan mostrar el nombre del cliente — si sí, usar el snapshot en vez de un join nuevo.

### Criterios de aceptación
- Un pedido creado hoy, tras eliminar al cliente que lo hizo, sigue mostrando su nombre y teléfono en `/admin` y en la tabla de restaurante.
- Pedidos históricos (previos a la migración) muestran el nombre gracias al backfill.
- No se rompe ningún tipo de TypeScript existente.

---

## Fase 2 — Liberación y cancelación automática de pedidos activos

**Por qué:** Es el único bug con impacto directo en usuarios reales: un pedido queda "colgado" en tracking eterno para el cliente, e inasignable para otros repartidores, si el repartidor o restaurante asociado se desactiva/elimina.

### Tareas

#### 2.1 — Caso Repartidor

1. **Nuevo helper** `lib/admin/delivery-lifecycle.ts`
   ```ts
   export async function hasActiveDelivery(client: AdminClient, deliveryPersonId: string) {
     const { data } = await client
       .from('deliveries')
       .select('id, order_id, orders!inner(status)')
       .eq('delivery_person_id', deliveryPersonId)
       .in('orders.status', ['ASSIGNED', 'PICKED_UP', 'ON_THE_WAY'])
       .limit(1)
       .maybeSingle()
     return data
   }

   export async function releaseDeliveryOrder(client: AdminClient, orderId: string, deliveryRowId: string) {
     // Transacción lógica: liberar el pedido al pool y limpiar la fila de deliveries
     await client.from('orders').update({ status: 'PENDING' }).eq('id', orderId)
     await client.from('deliveries').delete().eq('id', deliveryRowId)
   }
   ```

2. **Modificar `deactivateUser()`** en `lib/actions/admin.ts`
   - Antes del `update({ is_active: false })`, llamar a `hasActiveDelivery`.
   - Si existe: bloquear la acción y devolver mensaje claro: *"Este repartidor tiene una entrega en curso (#<id>). Reasígnala o espera a que la complete antes de desactivarlo."*
   - Exponer esto en la UI (`DeliveryRowActions` / `RowActions`) como un toast de error ya soportado por el patrón actual (`toast.error`).

3. **Modificar `deleteUser()`** en `lib/actions/admin.ts`
   - Mismo chequeo `hasActiveDelivery` antes de `auth.admin.deleteUser()`.
   - Si el repartidor está inactivo hace tiempo con un pedido colgado de una desactivación anterior (caso borde, no debería pasar tras el punto 2.2, pero por defensividad): usar `releaseDeliveryOrder` automáticamente y notificar en el resultado de la acción cuántos pedidos se liberaron.

4. **Ruta API** `app/api/v1/deliveries/[orderId]/accept/route.ts` y `advance/route.ts`
   - Sin cambios funcionales necesarios (ya filtran por `delivery_person_id`), pero agregar un test manual: confirmar que un pedido liberado a `PENDING` vuelve a aparecer en `/repartidor/disponibles` para otro repartidor.

#### 2.2 — Caso Restaurante

1. **Modificar `lib/admin/remove-restaurant.ts` → `removeRestaurant()`**
   - Antes de decidir soft/hard delete, buscar pedidos `PENDING` con `order_items.restaurant_id = restaurantId`.
   - Para cada uno: `update({ status: 'CANCELLED' })` + (opcional, si agregas el campo) `notes: notes ? notes + ' [Cancelado: negocio no disponible]' : 'Cancelado: negocio no disponible'`.
   - Hacerlo **antes** del soft-delete del restaurante, dentro de la misma función, para que quede atómico a nivel de lógica de aplicación.

2. **Aplicar la misma lógica** en `app/api/v1/restaurants/[id]/route.ts` → `DELETE` (ya reutiliza `removeRestaurant`, así que se resuelve solo si el cambio vive en el helper compartido — confirmar que no hay lógica duplicada en la ruta).

3. **Notificación al cliente (opcional pero recomendado)**
   - Ya tienes Supabase Realtime en `orders` (migración `20260922103915_enable_realtime_orders.sql`) y `OrderStatusSection` escucha cambios `UPDATE`. Al cancelar automáticamente, el cliente ya verá el cambio de estado en vivo sin trabajo adicional — solo confirmar que el mensaje de "Cancelado" en `OrderStatusTimeline` comunique bien el motivo (hoy es genérico: "Este pedido fue cancelado").
   - Mejora menor: si agregas una columna `cancellation_reason` a `orders`, puedes mostrar "Cancelado — el negocio ya no está disponible" en vez de un mensaje genérico.

### Criterios de aceptación
- Desactivar un repartidor con entrega activa se bloquea con mensaje claro; desactivar uno sin entregas activas funciona igual que hoy.
- Desactivar/eliminar un restaurante cancela automáticamente sus pedidos `PENDING`; los pedidos ya `ASSIGNED`/en curso con ese restaurante (si existieran) se documentan como caso conocido para revisión manual del admin (no se auto-cancelan entregas ya en camino).
- Ningún pedido queda en estado `ASSIGNED`/`PICKED_UP`/`ON_THE_WAY` con `delivery_person_id = null` de forma persistente.

---

## Fase 3 — Política unificada de hard-delete vs. soft-delete

**Por qué:** Hoy `removeRestaurant()` decide inteligentemente según historial, pero `deleteUser()` (clientes y, si se reutiliza, repartidores) hard-borra siempre, confiando solo en los `ON DELETE SET NULL`. Se necesita la misma regla de decisión en los tres roles.

### Tareas

1. **Nuevo helper genérico** `lib/admin/has-transactional-history.ts`
   ```ts
   type HistoryCheck =
     | { role: 'CUSTOMER'; profileId: string }
     | { role: 'DELIVERY'; profileId: string }

   export async function hasTransactionalHistory(client: AdminClient, check: HistoryCheck): Promise<boolean> {
     if (check.role === 'CUSTOMER') {
       const { data } = await client.from('orders').select('id')
         .eq('customer_id', check.profileId).limit(1).maybeSingle()
       return !!data
     }
     const { data } = await client.from('deliveries').select('id')
       .eq('delivery_person_id', check.profileId).limit(1).maybeSingle()
     return !!data
   }
   ```

2. **Modificar `deleteUser()`** en `lib/actions/admin.ts`
   - Obtener el `role` del perfil antes de decidir.
   - Si `hasTransactionalHistory` es `true`:
     - No llamar a `auth.admin.deleteUser()`.
     - En su lugar: desactivar (`is_active: false`), y opcionalmente revocar acceso de login (Supabase permite `banDuration` en `auth.admin.updateUserById` para bloquear el login sin borrar la cuenta).
     - Ejecutar el paso de anonimización de la Fase 5 sobre los campos de PII editable.
   - Si es `false` (nunca generó historial): mantener el comportamiento actual de hard-delete completo.

3. **Actualizar mensajes de UI**
   - `UserRowActions.tsx` / `ConfirmDialog`: cambiar el texto de confirmación para reflejar que, si la cuenta tiene historial, la acción es "desactivar y anonimizar" en vez de "eliminar" — evita expectativas incorrectas del admin.
   - Considerar renombrar el botón condicionalmente: `"Eliminar"` si no hay historial, `"Desactivar y anonimizar"` si lo hay (requiere pasar `hasHistory` como prop desde el server component que lista usuarios).

4. **Página de listado** `app/admin/usuarios/page.tsx` y `app/admin/repartidores/page.tsx`
   - Al traer la lista, incluir un flag `hasOrders`/`hasDeliveries` (un `count` o `exists` por fila, o una vista/subquery agregada) para decidir qué botón mostrar sin una llamada extra por fila en el cliente.

### Criterios de aceptación
- Una cuenta de cliente o repartidor sin ningún pedido/entrega histórico se puede seguir borrando por completo (comportamiento actual, sin regresión).
- Una cuenta con historial nunca se borra de `auth.users`; queda desactivada, no puede iniciar sesión, y su perfil aparece anonimizado.
- El admin ve claramente en la UI qué tipo de acción va a ejecutar antes de confirmar.

---

## Fase 4 — Limpieza de archivos huérfanos en ImageKit

**Por qué:** El hard-delete de restaurantes (cuando no tienen pedidos) borra las filas de `products`/`categories` por `ON DELETE CASCADE`, pero nunca llama a `deleteImageKitFileSafe` para los `image_file_id`/`logo_file_id` correspondientes. Esos archivos quedan huérfanos indefinidamente.

### Tareas

1. **Modificar `lib/admin/remove-restaurant.ts`**
   - Antes del branch de hard-delete (`if (!hasOrders)`):
     ```ts
     const { data: restaurant } = await client
       .from('restaurants')
       .select('logo_file_id')
       .eq('id', restaurantId)
       .maybeSingle()

     const { data: products } = await client
       .from('products')
       .select('image_file_id')
       .eq('restaurant_id', restaurantId)

     // ... después de confirmar que se procederá con el hard-delete real,
     // pero antes o después del `.delete()` de restaurants (mejor antes,
     // por si el delete falla no queremos huérfanos añadidos a mitad de camino):
     await Promise.all([
       deleteImageKitFileSafe(restaurant?.logo_file_id),
       ...(products ?? []).map((p) => deleteImageKitFileSafe(p.image_file_id)),
     ])
     ```
   - Importar `deleteImageKitFileSafe` desde `lib/imagekit-server.ts` (ya existe y ya es "best-effort": no lanza error si falla).

2. **Caso soft-delete:** no aplica — el restaurante sigue existiendo, sus imágenes deben conservarse por si se reactiva.

3. **Auditoría de otros puntos de eliminación de imágenes**
   - Revisar `lib/actions/products.ts` → `deleteProduct()`: ya llama a `deleteImageKitFileSafe` correctamente (confirmar que sigue así, sin cambios necesarios — se documenta como control de calidad, no como tarea nueva).
   - Confirmar que no existe una ruta equivalente para "eliminar repartidor" que borre alguna imagen de perfil (hoy no aplica porque no hay foto de perfil de repartidor en el esquema actual — dejar nota para cuando se agregue esa feature).

### Criterios de aceptación
- Eliminar un restaurante sin pedidos (hard-delete) deja la cuenta de ImageKit sin archivos huérfanos de ese restaurante.
- Un restaurante desactivado (soft-delete, con pedidos) conserva sus imágenes intactas.

---

## Fase 5 — Anonimización de PII vs. conservación de evidencia (Ley 29733)

**Por qué:** Formalizar, con código y no solo con intención, la regla: dato personal identificable se elimina/anonimiza; registro transaccional se conserva siempre.

### Tareas

1. **Definir qué campos son PII editable por rol** (documentar en el propio código, no solo en un doc externo):
   - `profiles`: `full_name`, `phone`, `document_type`, `document_number`, `email`.
   - `addresses`: `address_text`, `reference`, `latitude`, `longitude`.
   - `orders`: los nuevos `customer_name`/`customer_phone` de la Fase 1 — **estos NO se anonimizan**, porque son snapshot histórico intencional (igual que `product_name`), no dato "vivo" del perfil.

2. **Nuevo helper** `lib/admin/anonymize-profile.ts`
   ```ts
   export async function anonymizeProfile(client: AdminClient, profileId: string) {
     await client.from('profiles').update({
       full_name: 'Usuario eliminado',
       phone: null,
       document_number: null,
       document_type: null,
     }).eq('id', profileId)

     // Direcciones del cliente: mantener para que orders.address_id
     // siga apuntando a una fila válida, pero limpiar el texto libre.
     await client.from('addresses').update({
       address_text: 'Dirección eliminada',
       reference: null,
     }).eq('customer_id', profileId)
   }
   ```
   - Llamar a este helper desde `deleteUser()` (Fase 3) cuando `hasTransactionalHistory` sea `true`, en vez de hacer un hard-delete.

3. **Revocar acceso de login sin borrar la fila de `auth.users`**
   - Usar `adminClient.auth.admin.updateUserById(authId, { ban_duration: '876000h' })` (equivalente a "permanente") o cambiar el email a uno no funcional + invalidar password, según lo que soporte tu versión del SDK de Supabase.
   - Documentar la elección exacta en `decisions-and-learnings.md` del proyecto una vez implementado, porque el comportamiento exacto de `ban_duration` puede variar entre versiones del SDK.

4. **Actualizar `app/(public)/privacidad/page.tsx`**
   - Sección 6 ("Conservación de datos") ya dice, en términos generales, que se conservan datos mientras la cuenta esté activa y "el plazo necesario para cumplir obligaciones legales". Agregar una frase explícita: *"Si solicitas la eliminación de tu cuenta y tienes historial de pedidos, tus datos de identificación se anonimizan; el registro de la transacción (sin datos que te identifiquen directamente) se conserva por [N años] por obligaciones contables."* — reemplazar `[N años]` por el plazo real que definas con tu contador (SUNAT: usualmente 5 años).

### Criterios de aceptación
- Tras "eliminar" una cuenta con historial, ningún campo de PII editable queda legible en `profiles`/`addresses`.
- El registro de pedidos sigue siendo legible y coherente (montos, fechas, nombre-al-momento-del-pedido vía snapshot) para fines contables/soporte.
- La cuenta anonimizada no puede volver a iniciar sesión.
- La página de privacidad refleja el comportamiento real del sistema.

---

## Fase 6 — Documentación y guardas de regresión

**Por qué:** Estas reglas de negocio son sutiles (fáciles de romper sin darse cuenta en un refactor futuro) y no están cubiertas por ningún test hoy.

### Tareas

1. **Actualizar `decisions-and-learnings.md`** (memoria del proyecto) con las decisiones tomadas en las Fases 1–5, en el mismo formato que las entradas existentes (una viñeta por decisión concreta).

2. **Agregar comentarios de "por qué" en el código**, no solo "qué hace" — siguiendo el estilo que ya usas en migraciones (ej. `20260923100000_deliveries_person_set_null.sql` tiene un comentario excelente explicando el porqué). Aplicar el mismo nivel de detalle a los nuevos helpers de las Fases 2, 3 y 5.

3. **Checklist manual de QA** (si no hay infraestructura de tests automatizados todavía) para ejecutar antes de cada release que toque estas rutas:
   - [ ] Eliminar cliente sin pedidos → hard-delete completo.
   - [ ] Eliminar cliente con pedidos → anonimizado, no login, pedidos visibles con snapshot.
   - [ ] Desactivar repartidor sin entrega activa → funciona.
   - [ ] Desactivar repartidor con entrega activa → bloqueado con mensaje.
   - [ ] Eliminar restaurante sin pedidos → hard-delete + imágenes borradas de ImageKit.
   - [ ] Eliminar restaurante con pedidos `PENDING` → esos pedidos se cancelan automáticamente y el cliente ve el cambio en tiempo real.
   - [ ] Pedido liberado de un repartidor vuelve a aparecer en `/repartidor/disponibles`.

4. **(Opcional, si el proyecto crece)** Introducir tests de integración mínimos sobre `lib/admin/*` usando un entorno de Supabase local (`supabase start`), dado que ya usas la CLI de Supabase (`supabase/.temp/` presente en el repo).

### Criterios de aceptación
- Cualquier desarrollador nuevo puede leer `decisions-and-learnings.md` y entender por qué existen los helpers de anonimización/liberación sin tener que arqueológicamente reconstruir el razonamiento.
- El checklist de QA se ejecuta y pasa antes de mergear los cambios de las Fases 1–5.

---

## Resumen de archivos nuevos y modificados

**Nuevos:**
- `supabase/migrations/<timestamp>_orders_customer_snapshot.sql`
- `lib/admin/delivery-lifecycle.ts`
- `lib/admin/has-transactional-history.ts`
- `lib/admin/anonymize-profile.ts`

**Modificados:**
- `lib/actions/orders.ts`
- `app/api/v1/orders/route.ts`
- `lib/actions/admin.ts`
- `lib/admin/remove-restaurant.ts`
- `types/database.ts`
- `components/features/admin/RecentOrdersTable.tsx`
- `components/features/admin/UserRowActions.tsx` / `RowActions.tsx` (mensajes de confirmación)
- `app/admin/usuarios/page.tsx`, `app/admin/repartidores/page.tsx` (flag de historial)
- `app/(public)/privacidad/page.tsx`
- `/projects/.../decisions-and-learnings.md` (memoria del proyecto, no código)
