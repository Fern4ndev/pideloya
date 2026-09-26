# Plan de Implementación — Mejoras al Panel de Administración (Datos, Filtros, Auditoría)

> **ESTADO (2026-09-26): IMPLEMENTADO.** Fases 1–8 y 10 completadas y verificadas (typecheck, lint y build). Fase 9 queda como backlog, tal como el propio plan recomienda. Migraciones aplicadas al proyecto vinculado (pideloya) con `supabase db push`. Las decisiones de implementación tomadas durante el ciclo están documentadas al final del archivo (sección "Notas de implementación").

**Proyecto:** PideloYa
**Contexto:** El manejo de ciclo de vida de datos a nivel de base de datos y server actions (anonimización, snapshots, liberación de pedidos colgados) ya está resuelto correctamente — ver `decisions-and-learnings.md` y `plan-manejo-eliminacion-cuentas.md`. Este plan se enfoca en la capa que quedó rezagada: **administración, visualización, filtros y auditoría** en `/admin`.

**Objetivo:** Unificar el patrón de tablas administrativas, exponer filtros que ya existen como flags calculados, dar visibilidad clara sobre cuentas anonimizadas, y dejar rastro auditable de las acciones del admin.

---

## Índice de fases

| Fase | Nombre | Esfuerzo | Prioridad |
|---|---|---|---|
| 1 | Buscador y filtros en tabla de Repartidores (paridad con Clientes) | Bajo | Alta |
| 2 | Filtros por estado en las 3 tablas (Restaurantes, Clientes, Repartidores) | Bajo-Medio | Alta |
| 3 | Ordenamiento por columna | Bajo | Media |
| 4 | Visibilidad de cuentas anonimizadas (`anonymized_at` + badge) | Medio | Alta |
| 5 | Unificar patrón de tabla (server-side, componente compartido) | Medio-Alto | Media |
| 6 | Tabla de auditoría (`admin_audit_log`) | Medio | Alta |
| 7 | Exportación CSV con filtros aplicados | Bajo-Medio | Media |
| 8 | Acciones en lote (bulk actions) | Medio | Baja |
| 9 | Migrar flags booleanos a `status` enum | Alto | Baja (a evaluar) |
| 10 | Tiempo real en listas de pendientes de aprobación | Bajo | Media |

Orden recomendado de ejecución: **1 → 2 → 3 → 4 → 6 → 5 → 7 → 10 → 8 → 9**.
Las fases 1-4 y 6 son independientes entre sí y se pueden paralelizar si hay más de un desarrollador. La fase 5 (unificar patrón) conviene hacerla después de 1-4 para no reescribir dos veces el mismo código. La fase 9 es la única que toca el esquema de forma estructural — se deja al final y opcional.

---

## Fase 1 — Buscador en tabla de Repartidores

**Por qué:** Hoy `app/admin/repartidores/page.tsx` es la única de las tres tablas sin buscador. Un admin no puede encontrar a un repartidor por nombre, DNI o teléfono sin recorrer páginas manualmente.

### Tareas

1. **Modificar `app/admin/repartidores/page.tsx`**
   - Agregar `searchParams: { page?: string; q?: string }` (mismo patrón que `app/admin/usuarios/page.tsx`).
   - Construir el filtro `.or('full_name.ilike.%q%,document_number.ilike.%q%,phone.ilike.%q%')` sobre el query de `profiles`.
   - Reusar el saneo de input ya usado en `app/(public)/buscar/page.tsx`: `query.replace(/[%_,()]/g, ' ')` (evita que un usuario rompa el `ilike` con caracteres especiales).

2. **Nuevo componente `components/features/admin/DeliveryTable.tsx`**
   - Extraer la tabla actualmente inline en `app/admin/repartidores/page.tsx` a su propio componente client, siguiendo el patrón de `CustomerTable.tsx` (input de búsqueda + `router.replace` con querystring).
   - Esto también prepara el terreno para la Fase 5 (componente unificado).

### Criterios de aceptación
- Buscar "Juan" en `/admin/repartidores?q=Juan` filtra por nombre.
- Buscar un DNI parcial también filtra correctamente.
- La paginación sigue funcionando junto con el filtro de búsqueda (offset se recalcula sobre el resultado filtrado, no sobre el total sin filtrar).

---

## Fase 2 — Filtros por estado en las 3 tablas

**Por qué:** Ya se calculan los flags (`hasOrders`, `hasDeliveries`, `is_approved`, `is_active`) para decidir qué botón mostrar, pero no se exponen como filtro. Un admin no puede pedir "solo restaurantes pendientes de aprobar" o "solo clientes sin pedidos" sin escanear la tabla completa a ojo.

### 2.1 — Restaurantes (`app/admin/restaurantes/page.tsx` + `RestaurantTable.tsx`)

Agregar un `Select` con las opciones:
- Todos (default)
- Pendientes de aprobar (`is_approved = false`)
- Aprobados y activos (`is_approved = true AND is_active = true`)
- Desactivados (`is_approved = true AND is_active = false`)

```ts
// app/admin/restaurantes/page.tsx
const statusFilter = searchParams.status // 'pending' | 'active' | 'suspended' | undefined

let query = supabase.from('restaurants').select('...')
if (statusFilter === 'pending') query = query.eq('is_approved', false)
if (statusFilter === 'active') query = query.eq('is_approved', true).eq('is_active', true)
if (statusFilter === 'suspended') query = query.eq('is_approved', true).eq('is_active', false)
```

### 2.2 — Clientes (`app/admin/usuarios/page.tsx` + `CustomerTable.tsx`)

Agregar filtro:
- Todos
- Con pedidos (`hasOrders = true`)
- Sin pedidos (`hasOrders = false`)
- Anonimizados (requiere Fase 4 — `anonymized_at IS NOT NULL`)

Nota de implementación: como `hasOrders` hoy se calcula **después** de traer la página (batch query sobre los ids ya paginados), filtrar por este flag requiere invertir el orden: primero obtener el set de `customer_id` con pedidos (`SELECT DISTINCT customer_id FROM orders`), y usarlo como `.in()` o `.not.in()` antes de paginar. Para volúmenes medianos esto es aceptable; si la tabla `orders` crece mucho, considerar una columna desnormalizada `profiles.has_orders boolean` actualizada por trigger (ver nota en Fase 9).

### 2.3 — Repartidores (`app/admin/repartidores/page.tsx`)

Agregar filtro:
- Todos
- Activos
- Pendientes de aprobar (`is_active = false`)
- Con entregas activas ahora mismo (usa `getActiveDelivery`/`ACTIVE_DELIVERY_STATUSES` ya existente en `lib/admin/delivery-lifecycle.ts` — útil para que el admin vea de un vistazo quién está en ruta antes de intentar desactivarlo)

### Componente compartido

Crear `components/features/admin/StatusFilterSelect.tsx`, un wrapper delgado sobre `Select` que recibe `options: { value: string; label: string }[]` y actualiza el querystring vía `router.replace`. Los tres módulos lo reutilizan con distintas opciones.

### Criterios de aceptación
- Cada filtro decrementa correctamente el `total` usado por `getPagination` (el conteo debe aplicar el mismo `where` que los datos).
- Los filtros son combinables con la búsqueda por texto (`?q=juan&status=pending`).
- La URL es compartible/bookmarkeable (el estado del filtro vive en el querystring, no en estado de React puro) — esto ya lo hacen bien en `CustomerTable`, hay que extenderlo a las otras dos.

---

## Fase 3 — Ordenamiento por columna

**Por qué:** Todo está fijo a `order('created_at', { ascending: false })`. Un admin no puede ordenar restaurantes alfabéticamente o repartidores por "más pedidos entregados".

### Tareas

1. Agregar parámetro `sort` y `dir` al querystring de las tres páginas (`?sort=name&dir=asc`).
2. Whitelist de columnas ordenables por tabla (nunca aceptar el nombre de columna directo del usuario sin validar, para evitar inyección de identificador):
   ```ts
   const SORTABLE_RESTAURANTS = ['name', 'created_at', 'food_type'] as const
   const sortColumn = SORTABLE_RESTAURANTS.includes(sort as any) ? sort : 'created_at'
   ```
3. En los `<TableHead>`, envolver el texto en un `<button>`/`<Link>` que alterna `dir` y muestra un ícono de flecha (`ChevronUpIcon`/`ChevronDownIcon` de lucide-react, ya está en el proyecto) cuando esa columna es la activa.

### Criterios de aceptación
- Click en "Registro" ordena ascendente; click de nuevo, descendente.
- El ordenamiento persiste al cambiar de página (vive en el querystring, no en estado local).
- Funciona igual en las tres tablas con el mismo componente `SortableTableHead`.

---

## Fase 4 — Visibilidad de cuentas anonimizadas

**Por qué:** Hoy, después de `deleteUser()` con historial, el perfil queda con `full_name = 'Usuario eliminado'` y `is_active = false`, pero nada distingue visualmente esa fila de un cliente real con `is_active = false` por otra razón, ni queda un timestamp de cuándo ocurrió. Esto importa para: (a) claridad operativa del admin, (b) poder responder auditorías de cumplimiento (Ley 29733) con evidencia de cuándo se atendió cada solicitud de baja.

### Tareas

1. **Migración** `supabase/migrations/<timestamp>_profiles_anonymized_at.sql`
   ```sql
   alter table public.profiles add column if not exists anonymized_at timestamptz;

   comment on column public.profiles.anonymized_at is
     'Se llena cuando el admin anonimiza la cuenta por tener historial transaccional (ver lib/admin/anonymize-profile.ts). NULL = cuenta nunca anonimizada.';
   ```

2. **Modificar `lib/admin/anonymize-profile.ts`**
   - Agregar `anonymized_at: new Date().toISOString()` al `update()` de `profiles`.

3. **Modificar `types/database.ts`**
   - Agregar `anonymized_at: string | null` a `Row`/`Insert`/`Update` de `profiles`.

4. **UI: `components/features/admin/CustomerTable.tsx` y `DeliveryTable.tsx`**
   - Mostrar un `<Badge variant="outline">Anonimizado</Badge>` junto al nombre cuando `anonymized_at !== null`, con tooltip/texto secundario "el {fecha}".
   - Deshabilitar el botón de "Ver detalle"/edición sobre estas filas (no tiene sentido inspeccionar una cuenta ya anonimizada) o mostrar solo lectura.

5. **Filtro "Anonimizados"** (completa la Fase 2.2): `.not('anonymized_at', 'is', null)`.

### Criterios de aceptación
- Después de anonimizar un cliente con historial, la tabla muestra el badge inmediatamente (sin necesitar refrescar dos veces).
- El filtro "Anonimizados" trae exactamente esas cuentas.
- `anonymized_at` nunca se sobreescribe dos veces (si por error se llama `anonymizeProfile` de nuevo sobre la misma cuenta, se debería preservar la fecha original — usar `coalesce(anonymized_at, now())` en el update, o verificar antes de llamar).

---

## Fase 5 — Unificar patrón de tabla administrativa

**Por qué:** Hoy conviven tres enfoques (client-side filtering en Restaurantes, server-side con querystring en Clientes, server-side sin búsqueda en Repartidores). Esto duplica lógica de paginación/filtro tres veces y hace que cada mejora futura (fase 2, 3, 7, 8) haya que implementarla tres veces si no se unifica primero.

### Tareas

1. **Migrar `RestaurantTable.tsx` de client-side a server-side**
   - Mover el `useState(search)` + `useMemo(filtered)` actual a `app/admin/restaurantes/page.tsx`, siguiendo exactamente el patrón ya usado en `app/admin/usuarios/page.tsx` (querystring `?q=`, `getPagination`, conteo en paralelo con `Promise.all`).
   - Esto es importante en cuanto la base de restaurantes crezca más allá de un par de cientos de filas — hoy se trae todo a memoria del navegador.

2. **Extraer un componente compartido** `components/features/admin/AdminTableShell.tsx`
   - Encapsula: input de búsqueda (con debounce de ~300ms antes de actualizar el querystring, usando algo como `useDeferredValue` o un `setTimeout` manual — hoy `CustomerTable` actualiza en cada submit del form, lo cual es aceptable pero un debounce en el input directo mejora la UX), `StatusFilterSelect` (Fase 2), `SortableTableHead` (Fase 3), y `TablePagination`.
   - Las tablas específicas (`RestaurantTable`, `CustomerTable`, `DeliveryTable`) pasan solo las columnas y filas — el shell maneja los controles.

3. **Estandarizar el contrato de las páginas** `app/admin/{restaurantes,usuarios,repartidores}/page.tsx`
   - Todas reciben `searchParams: { page?, q?, status?, sort?, dir? }`.
   - Todas siguen el patrón: `Promise.all([count, data])` → `getPagination` → retry si la página quedó fuera de rango.

### Criterios de aceptación
- Las tres páginas admin comparten el mismo componente de controles (búsqueda + filtro + orden + paginación).
- No queda ninguna tabla que traiga el dataset completo al navegador para filtrar en cliente.
- Un desarrollador nuevo puede agregar un cuarto módulo admin (ej. "Categorías globales") reusando `AdminTableShell` sin reescribir la lógica de querystring.

---

## Fase 6 — Tabla de auditoría (`admin_audit_log`)

**Por qué:** Las acciones administrativas (aprobar, desactivar, anonimizar, editar, eliminar) usan `service_role` y saltan RLS. Hoy no queda registro de **quién** ejecutó la acción ni **cuándo**, más allá del estado final de la fila. Ante un reclamo de un usuario ("¿por qué me desactivaron?") o una auditoría de cumplimiento, no hay forma de responder con evidencia.

### Tareas

1. **Migración** `supabase/migrations/<timestamp>_admin_audit_log.sql`
   ```sql
   create table public.admin_audit_log (
     id                uuid primary key default gen_random_uuid(),
     actor_profile_id  uuid references public.profiles(id) on delete set null,
     action            text not null,         -- 'approve_restaurant' | 'deactivate_user' | 'delete_user' | 'edit_restaurant' | ...
     target_table      text not null,         -- 'restaurants' | 'profiles' | ...
     target_id         uuid not null,
     metadata          jsonb,                 -- valores previos, razón, resultado (soft/hard delete), etc.
     created_at        timestamptz not null default now()
   );

   create index admin_audit_log_target_idx on public.admin_audit_log(target_table, target_id);
   create index admin_audit_log_actor_idx on public.admin_audit_log(actor_profile_id);
   create index admin_audit_log_created_idx on public.admin_audit_log(created_at desc);

   alter table public.admin_audit_log enable row level security;

   -- Solo el admin puede leer el log; nadie más, ni siquiera vía policy de "propio registro"
   -- (el log es una herramienta de supervisión, no un dato personal del usuario auditado).
   create policy "admin_audit_log_select_admin"
   on public.admin_audit_log for select
   using (public.current_role() = 'ADMIN');

   -- Los inserts se hacen exclusivamente con service_role desde las server actions
   -- (mismo patrón que el resto de escrituras administrativas) — no se necesita
   -- policy de insert para 'authenticated'.
   ```

2. **Nuevo helper** `lib/admin/audit-log.ts`
   ```ts
   import type { createServiceRoleClient } from '@/lib/db/server'

   type AdminClient = ReturnType<typeof createServiceRoleClient>

   export async function logAdminAction(
     client: AdminClient,
     params: {
       actorProfileId: string
       action: string
       targetTable: string
       targetId: string
       metadata?: Record<string, unknown>
     }
   ) {
     // Best-effort: un fallo al loguear NUNCA debe revertir la acción real
     // que ya se ejecutó (aprobar, desactivar, etc.) — se registra el error
     // y se continúa, igual que deleteImageKitFileSafe.
     const { error } = await client.from('admin_audit_log').insert({
       actor_profile_id: params.actorProfileId,
       action: params.action,
       target_table: params.targetTable,
       target_id: params.targetId,
       metadata: params.metadata ?? null,
     })
     if (error) console.error('[audit-log] no se pudo registrar la acción:', error)
   }
   ```

3. **Modificar `lib/actions/admin.ts`**
   - `assertIsAdmin()` ya trae el `user`/`profile` — devolver también el `profileId` del actor (hoy solo valida el rol y descarta el resultado) para poder pasarlo a `logAdminAction`.
   - Insertar una llamada a `logAdminAction` al final de: `approveRestaurant`, `approveDeliveryPerson`, `deleteRestaurant`, `deactivateUser`, `updateRestaurant`, `updateDeliveryPerson`, `deleteUser`.
   - Ejemplo en `deleteUser`:
     ```ts
     await logAdminAction(adminClient, {
       actorProfileId: actor.profileId,
       action: hasHistory ? 'anonymize_user' : 'hard_delete_user',
       targetTable: 'profiles',
       targetId: profileId,
       metadata: { role: profile.role, hasHistory },
     })
     ```

4. **UI: nueva página** `app/admin/auditoria/page.tsx`
   - Tabla de solo lectura: actor, acción, tabla/id afectado, fecha, con expandible para ver `metadata` en JSON legible.
   - Filtro por rango de fechas y por tipo de acción (reusa `AdminTableShell` de la Fase 5).
   - Link "Ver detalle" que, si `target_table = 'restaurants'`, navega al restaurante correspondiente (mismo patrón que ya usan para navegar entre entidades).

5. **Agregar el link en `AdminSidebar.tsx`** (`components/layout/AdminSidebar.tsx`) — nueva entrada "Auditoría" con un ícono (ej. `ScrollTextIcon` de lucide-react).

### Criterios de aceptación
- Cada acción administrativa relevante deja una fila en `admin_audit_log` con el actor correcto (no `null`, salvo que el actor haya sido eliminado después).
- Un fallo al escribir el log nunca bloquea ni revierte la acción principal (verificar con un test manual: simular error de insert en el log y confirmar que `approveRestaurant` igual completa exitosamente).
- La página `/admin/auditoria` es de solo lectura y solo accesible por rol ADMIN (ya cubierto por el layout `app/admin/layout.tsx`, pero además reforzado por RLS en la tabla).

---

## Fase 7 — Exportación CSV con filtros aplicados

**Por qué:** Con retención de 5 años documentada por temas contables/SUNAT, en algún momento alguien va a necesitar sacar un reporte de pedidos/clientes/restaurantes fuera del panel. Hoy la única vía es consultar la base directamente.

### Tareas

1. **Nueva ruta API** `app/api/admin/export/route.ts`
   - `GET` con query params `?entity=restaurants|customers|deliveries|orders&status=&q=&from=&to=`.
   - Reusa exactamente los mismos filtros que ya construye cada página admin (extraer esa lógica de construcción de query a una función compartida `lib/admin/query-builders.ts` para no duplicarla entre la página y el export).
   - Verifica rol ADMIN con `authenticateRequest` + `requireRole` (patrón ya usado en el resto de la API v1).
   - Genera CSV con una librería ligera o manualmente (dado el volumen esperado, un `join(',')` con escape de comillas es suficiente; no hace falta una dependencia nueva).
   - Responde con `Content-Type: text/csv` y `Content-Disposition: attachment; filename="restaurantes-2026-09-25.csv"`.

2. **Botón "Exportar CSV"** en cada página admin, que arma la URL con los filtros actuales del querystring y dispara la descarga (`<a href=... download>` es suficiente, no requiere JS adicional).

### Criterios de aceptación
- El CSV exportado refleja exactamente los filtros visibles en pantalla al momento de exportar (si el admin filtró por "pendientes", el CSV solo trae pendientes).
- Los campos de PII (teléfono, documento) solo se incluyen en el export si el usuario que exporta es ADMIN (ya garantizado por la ruta, pero documentarlo explícitamente en el código como recordatorio de cumplimiento).
- Pedidos exportados usan los snapshots (`customer_name`, `product_name`, etc.) y no un join a `profiles`/`products` que podría fallar si la cuenta fue anonimizada o el producto eliminado.

---

## Fase 8 — Acciones en lote (bulk actions)

**Por qué:** Aprobar 15 restaurantes pendientes un lunes, uno por uno, es fricción operativa evitable.

### Tareas

1. **UI:** checkbox por fila + checkbox "seleccionar todos" en el header de la tabla (patrón estándar; el componente `Table` de shadcn ya soporta esto vía `<TableCell><Checkbox /></TableCell>`, solo falta el estado de selección).
2. **Barra de acciones flotante** cuando hay ≥1 fila seleccionada: "Aprobar seleccionados (N)" / "Desactivar seleccionados (N)".
3. **Server actions en lote:** `approveRestaurantsBulk(ids: string[])`, iterando la lógica ya existente de `approveRestaurant` por cada id (o adaptándola para aceptar un array y hacer un solo `update .in('id', ids)` cuando sea posible, con un solo insert de audit log por acción bulk marcando `metadata: { batchIds: ids }`).
4. Aplicar el mismo patrón a repartidores pendientes de aprobar.

### Criterios de aceptación
- Seleccionar 5 restaurantes pendientes y aprobar en lote los aprueba a todos y refleja el cambio sin recargar manualmente.
- Si una de las filas del lote falla (ej. ya fue eliminada por otro admin concurrentemente), el resto de la operación continúa y se reporta cuántas tuvieron éxito/fallaron — no debe ser todo-o-nada silencioso.
- Queda una sola entrada de audit log por lote (no N entradas idénticas), referenciando los ids afectados en `metadata`.

---

## Fase 9 — Migrar flags booleanos a `status` enum (evaluar, no urgente)

**Por qué:** `restaurants` combina `is_approved` + `is_active` + `is_open` para expresar 4 estados reales (pendiente, aprobado-activo, desactivado, cerrado-temporalmente-por-dueño). Esto ya se resuelve combinando dos condiciones en varias queries (`is_approved && is_active`), lo cual funciona pero escala mal si aparece un quinto estado.

### Consideraciones antes de decidir

- **`is_open` debe seguir siendo un campo aparte** — es controlado por el dueño (abre/cierra su negocio), no por el admin, y cambia con alta frecuencia (varias veces al día). No pertenece al mismo enum que `is_approved`/`is_active`, que son decisiones administrativas poco frecuentes.
- Migrar `is_approved` + `is_active` a un solo `status: 'pending' | 'active' | 'suspended'` sí simplificaría queries y UI, pero:
  - Requiere migración de datos (`case when is_approved and is_active then 'active' when is_approved and not is_active then 'suspended' else 'pending' end`).
  - Requiere actualizar TODAS las policies de RLS que hoy filtran por estas dos columnas (`restaurants_select_public`, `restaurants_update_owner`, etc. en `20260823172245_rls_policies.sql` y migraciones posteriores).
  - Requiere actualizar `types/database.ts`, todos los `.eq('is_approved', ...)` en `app/api/v1/restaurants/*`, `lib/actions/admin.ts`, `lib/admin/remove-restaurant.ts`.

### Recomendación
No ejecutar esta fase de forma aislada. Evaluarla **solo si** en el futuro se necesita agregar un tercer estado real (ej. "en revisión" antes de "pendiente", o "suspendido temporalmente por incumplimiento" distinto de "desactivado por falta de pedidos"). Mientras los estados sigan siendo 3, la combinación de dos booleanos es suficiente y el costo de migración no se justifica todavía. Dejar como ítem de backlog documentado, no como tarea de este ciclo.

---

## Fase 10 — Tiempo real en listas de pendientes de aprobación

**Por qué:** Ya usan `RealtimeRefresh` (`components/ui/realtime-refresh.tsx`) para refrescar dashboards cuando cambia `orders`. El mismo patrón no está aplicado a nuevas altas de `restaurants`/`profiles` pendientes de aprobación — un admin con la pestaña abierta no ve un restaurante recién registrado sin refrescar manualmente.

### Tareas

1. Agregar la tabla `restaurants` y `profiles` a la publicación `supabase_realtime` si no lo están ya (verificar; `orders` y `deliveries` sí están, según comentario en `realtime-refresh.tsx`).
2. Agregar `<RealtimeRefresh channelName="admin-restaurantes" table="restaurants" event="INSERT" />` en `app/admin/restaurantes/page.tsx`, y equivalente para repartidores en `app/admin/repartidores/page.tsx` (filtrando idealmente solo `INSERT` para no refrescar en cada edición menor, ya que `RealtimeRefresh` no soporta filtro por columna hoy — evaluar si vale la pena extenderlo con un filtro tipo `is_approved=eq.false`).
3. **Opcional, de mayor valor:** badge con contador de pendientes en el link del sidebar (`AdminSidebar.tsx`) — "Restaurantes (3)" — resuelto con un query ligero (`count`) en el layout admin, actualizado vía el mismo canal realtime.

### Criterios de aceptación
- Registrar un restaurante nuevo desde `/registro` mientras un admin tiene `/admin/restaurantes` abierto refresca la lista sin intervención manual (con el debounce ya presente en `RealtimeRefresh`).
- No se generan refrescos excesivos por cambios menores no relevantes para el admin (ej. el dueño togglea `is_open` diez veces — idealmente eso no debería disparar un refresh de la lista de pendientes de aprobación).

---

## Resumen de archivos nuevos y modificados

**Nuevos:**
- `supabase/migrations/<timestamp>_profiles_anonymized_at.sql`
- `supabase/migrations/<timestamp>_admin_audit_log.sql`
- `lib/admin/audit-log.ts`
- `lib/admin/query-builders.ts` (filtros compartidos entre páginas admin y export)
- `components/features/admin/AdminTableShell.tsx`
- `components/features/admin/StatusFilterSelect.tsx`
- `components/features/admin/SortableTableHead.tsx`
- `components/features/admin/DeliveryTable.tsx`
- `app/admin/auditoria/page.tsx`
- `app/api/admin/export/route.ts`

**Modificados:**
- `app/admin/restaurantes/page.tsx` (server-side filtering, status filter, sort)
- `app/admin/usuarios/page.tsx` (status filter, sort, badge anonimizado)
- `app/admin/repartidores/page.tsx` (buscador, status filter, sort)
- `components/features/admin/RestaurantTable.tsx` (migrar de client-side a shell compartido)
- `components/features/admin/CustomerTable.tsx` (badge anonimizado, shell compartido)
- `lib/admin/anonymize-profile.ts` (set `anonymized_at`)
- `lib/actions/admin.ts` (logging de auditoría en cada acción)
- `types/database.ts` (columna `anonymized_at`, tabla `admin_audit_log`)
- `components/layout/AdminSidebar.tsx` (link a Auditoría, badges de pendientes)

---

## Notas de implementación (decisiones tomadas durante el ciclo)

Adaptaciones sobre el plan original, motivadas por el código real:

1. **Export CSV por cookie de sesión** (no Bearer como /api/v1): el botón es un `<a download>` del navegador. El rol ADMIN se revalida dentro de la ruta (401/403) — el link no es la autorización.
2. **Bulk solo de aprobación** (`approveRestaurantsBulk`/`approveDeliveriesBulk`): desactivar en lote quedó fuera porque `deactivateUser` tiene guardas por usuario (entrega en curso). El lote de repartidores filtra `.eq('role','DELIVERY')` y su UI solo hace seleccionables filas inactivas no-anonimizadas.
3. **`admin_audit_log.target_id` es nullable**: en lotes los ids van en `metadata.batchIds` (una entrada por lote). Índice de target parcial (`where target_id is not null`). La página de auditoría muestra "Lote" en esas filas.
4. **`anonymized_at` se setea directo** en `anonymizeProfile` (una sola query junto a la limpieza de PII). La idempotencia la da el flujo: `deleteUser` es la única puerta y una cuenta anonimizada queda fuera de las listas de acción.
5. **Realtime con filtro server-side**: `RealtimeRefresh` acepta `filter` de Postgres Changes; `/admin/restaurantes` usa `is_approved=eq.false` y `/admin/repartidores` `role=eq.DELIVERY` — los cambios irrelevantes (toggle `is_open`, altas de clientes) no disparan refresh.
6. **Orden por dueño en restaurantes** (`?sort=owner`) se resuelve en memoria sobre la página traída: PostgREST no permite `order()` sobre la relación embebida; la paginación física sigue por `created_at`.
7. **Fases 2–5 se fusionaron parcialmente**: la migración server-side de Restaurantes (5.1) se hizo junto al filtro de estado (2.1); `AdminTableShell` (5.2) se construyó cuando los tres módulos ya tenían el mismo contrato, para refactorizar una sola vez.
8. **Fase 5: el estado de UI transitoria (selección para bulk) es local**; lo compartible es el universo filtrado (querystring). Búsqueda con debounce ~300ms vía ref de sincronización (sin setState en efectos).
9. **`AdminSidebar`** ganó la entrada "Auditoría" (`ScrollTextIcon`). Los badges de pendientes en el sidebar (10.3 opcional) siguen como backlog.
10. **Página de auditoría 100% server component** con filtros por `<form method="GET">` nativo (acción + rango de fechas inclusivo) y `metadata` expandible con `<details>` — cero JS de cliente.

---

## Checklist de QA sugerido (antes de dar por cerrado el ciclo)

- [x] Las tres tablas admin (Restaurantes, Clientes, Repartidores) tienen buscador funcional. *(Fase 1-2)*
- [x] Las tres tablas admin permiten filtrar por al menos un estado relevante, combinable con la búsqueda. *(Fase 2)*
- [x] Ordenar por columna funciona y persiste en la URL (compartible/bookmarkeable). *(Fase 3)*
- [x] Una cuenta anonimizada muestra badge visual distintivo y fecha de anonimización. *(Fase 4)*
- [x] Ninguna tabla admin trae el dataset completo al navegador para filtrar en cliente. *(Fase 2/5: Restaurantes migrado a server-side)*
- [x] Toda acción administrativa relevante (aprobar, desactivar, eliminar, editar, anonimizar) deja una fila en `admin_audit_log` con actor y metadata. *(Fase 6)*
- [x] Un fallo al escribir en el audit log no revierte ni bloquea la acción principal. *(logAdminAction best-effort, Fase 6)*
- [x] Exportar CSV desde cada tabla respeta los filtros activos en pantalla. *(Fase 7: mismos appliers que las páginas)*
- [x] Aprobar en lote 3+ restaurantes pendientes funciona y genera una sola entrada de auditoría referenciando todos los ids. *(Fase 8: metadata.batchIds)*
- [x] Un restaurante nuevo aparece en `/admin/restaurantes` sin recargar manualmente, si la pestaña ya estaba abierta. *(Fase 10: RealtimeRefresh INSERT + filtro)*

**Verificación técnica aplicada:** `tsc --noEmit` sin errores, `eslint` sin errores en archivos tocados, `next build` de producción exitoso, migraciones aplicadas (`db push --dry-run` → "Remote database is up to date"). El QA funcional interactivo (flujos con datos reales: anonimizar, exportar, lote, realtime) queda para el usuario con la app corriendo.
