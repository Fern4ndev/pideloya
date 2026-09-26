# Plan de Implementación — Pulido de Paneles (Restaurante / Repartidor)

> **ESTADO (2026-09-26): PLAN COMPLETO — FASES 1–6 IMPLEMENTADAS.** QA manual pendiente (ítems de sesión en 1.3, 3.3 y 6.2).
>
> - **Fase 1:** Migraciones `20260927000000_fix_products_categories_role_scope.sql` y `20260927000100_catalog_policies_role_allowlist.sql` creadas y **aplicadas al proyecto vinculado (pideloya / `jtggpdqucheuovvcjqff`)** con `supabase db push`; el `db push --dry-run` posterior responde "Remote database is up to date". La segunda endurece el fix a una allowlist `anon`/`CUSTOMER`/`ADMIN` (ver nota al final de 1.4). Capa 2 (defensa en profundidad) aplicada en las 3 páginas del panel de restaurante. Verificado con `tsc --noEmit`, `eslint` (0 errores / 0 warnings en los archivos tocados) y `next build` exitoso. El QA manual con dos restaurantes de prueba (ver 1.3) queda pendiente por requerir sesión con datos reales. Detalle en 1.4.
> - **Fase 2 (2026-09-26):** `lib/dashboard/chart-utils.ts` y `components/features/dashboard/DashboardRangeFilterBar.tsx` creados; `AdminDashboardCharts.tsx` refactorizado para consumirlos (extracción literal, cero cambio de comportamiento). `tsc --noEmit`, `eslint` y `next build` limpios. Detalle en 2.5.
> - **Fase 3 (2026-09-26):** dashboard de restaurante migrado al modelo Admin (una query con el rango máximo en el servidor + filtro/agregación en cliente), con la barra de filtros compartida y los gráficos reestilizados en lime/violeta con degradado. Detalle, y la única desviación consciente del plan (la barra de "Ventas" sigue midiendo S/), en 3.4.
> - **Fase 4 (2026-09-26):** creado `DeliveryDashboardCharts.tsx` (dos gráficos: entregas y ingresos) y `app/repartidor/page.tsx` migrado a una query con el rango máximo en el servidor + filtro en cliente. Las 4 tarjetas con SWR/Realtime quedaron intactas. Detalle en 4.4.
>
> - **Fases 5 y 6 (2026-09-26):** los tres paneles comparten ancho (`size="full"`), barra de filtros, primitivas de agregación, estilo de gráfico (lime/violeta con degradado), título con punto de color y estados vacíos con el estándar de Admin; `accessibilityLayer` y reduced motion verificados. QA automatizado en verde (typecheck/lint/build); QA de sesión documentado como pendiente en 6.3.
>
> **Pendiente:** solo el QA manual con sesión (dos restaurantes, dos repartidores, cliente anon/autenticado, admin, mobile) listado en 6.2.

**Proyecto:** PideloYa
**Autor del diagnóstico:** Revisión técnica estilo senior (Apple/Vercel) sobre el código real del repo.
**Alcance:** (1) Fuga de datos entre restaurantes en Productos/Categorías, (2) Unificación de filtros y estilo de gráficos entre Admin ↔ Restaurante ↔ Repartidor.
**Principio rector del plan:** cero archivos nuevos salvo que sea estrictamente necesario para no triplicar lógica frágil (fechas, agregaciones, RLS). Cada archivo nuevo propuesto está marcado explícitamente y justificado; todo lo demás son ediciones a archivos ya existentes.

> **Nota sobre las skills solicitadas:** me pediste usar `vercel-react-best-practices` y `ui-ux-pro-max` desde `C:\Users\ferna\.agents\skills`. Esa ruta vive en tu máquina local, no en el entorno donde yo ejecuto (sandbox aislado sin acceso a tu filesystem), así que no pude leer esos SKILL.md directamente. Este plan aplica los mismos principios que normalmente encapsulan esas skills — Server Components por defecto, colocación de datos, mutaciones vía Server Actions, `revalidatePath` quirúrgico, RLS como fuente de verdad + defensa en profundidad en cliente, design tokens consistentes, jerarquía visual, estados vacíos/carga, accesibilidad de gráficos — y los cito explícitamente en cada fase para que puedas verificarlos contra tus skills si difieren.

---

## Índice

| Fase | Nombre | Prioridad | Tipo |
|---|---|---|---|
| 0 | Diagnóstico de causa raíz (contexto, sin cambios de código) | — | Lectura |
| 1 | **[CRÍTICO/Seguridad]** Corregir fuga de productos/categorías entre restaurantes | Urgente | RLS + queries |
| 2 | Extraer primitivas compartidas de dashboard (filtros + agregación + estilo de gráfico) | Alta | Refactor base |
| 3 | Dashboard de Restaurante: filtros día/semana/mes + rango de fechas + restyle | Alta | Feature + UI |
| 4 | Dashboard de Repartidor: agregar gráficos reutilizando lo de la Fase 2 | Alta | Feature + UI |
| 5 | Auditoría de consistencia visual final (tokens, spacing, estados vacíos) | Media | Pulido |
| 6 | QA, checklist de regresión y orden de despliegue | Obligatoria | QA |

Orden recomendado de ejecución: **1 → 2 → 3 → 4 → 5 → 6**. La Fase 1 es un bug de aislamiento de datos (cada restaurante viendo el catálogo de otro) y debe salir primero e independiente de todo lo demás. Las Fases 3 y 4 dependen de la Fase 2.

---

## Fase 0 — Diagnóstico de causa raíz

### 0.1 — Por qué un restaurante ve productos/categorías de otros restaurantes

Encontré el bug exacto revisando las migraciones de RLS en orden cronológico. Esto **no es un bug de la UI** — es una policy de Postgres RLS demasiado permisiva que otra migración posterior introdujo sin darse cuenta de que afectaba también al rol `RESTAURANT`.

**Línea de tiempo de las policies de `products`:**

1. `supabase/migrations/20260823172245_rls_policies.sql` crea:
   - `products_select_owner`: `restaurant_id in (select current_restaurant_ids())` → correcto, solo tu propio restaurante.
2. `supabase/migrations/20260912000000_fix_rls_products_categories.sql` corrige `products_select_public` para que solo aplique a visitantes anónimos:
   - `using (auth.role() = 'anon' and available = true)` → correcto.
3. **`supabase/migrations/20260920201230_products_categories_customer_visibility.sql`** agrega una policy nueva para que el **cliente autenticado** (rol `CUSTOMER`) también pueda ver productos de otros restaurantes en el catálogo público:
   ```sql
   create policy "products_select_customer"
   on public.products for select
   using (
     available = true
     and restaurant_id in (
       select id from public.restaurants where is_approved = true and is_active = true
     )
   );
   ```
   **Esta policy no tiene ninguna condición de rol.** Postgres RLS combina todas las policies de `SELECT` con `OR`. Como resultado, un usuario autenticado con rol `RESTAURANT` cae bajo **dos** policies a la vez:
   - `products_select_owner` → ve su propio restaurante (correcto, incluso productos no disponibles).
   - `products_select_customer` → ve **todos los productos disponibles de todos los restaurantes aprobados y activos**, sin importar que su rol sea `RESTAURANT` (incorrecto).

   Lo mismo ocurre, calcado, con `categories_select_customer` en el mismo archivo — sin filtro de rol.

4. Encima, las páginas del panel de restaurante **nunca filtran explícitamente por `restaurant_id`** porque confiaron 100% en que RLS ya acotaba el resultado (un patrón válido *hasta* que la migración #3 lo rompió sin que nadie lo notara):
   - `app/restaurante/productos/page.tsx` → `supabase.from('products').select(...)` sin `.eq('restaurant_id', …)`.
   - `app/restaurante/categorias/page.tsx` → `supabase.from('categories').select('id, name')` sin filtro.
   - `app/restaurante/productos/nuevo/page.tsx` → la query de categorías para el `<Select>` del formulario, sin filtro.

   Resultado observable: el dueño de un restaurante entra a "Productos" o "Categorías" y ve el catálogo completo de la plataforma mezclado con el suyo.

Esto se corrige en la **Fase 1**, con dos capas (RLS + query explícita), como manda cualquier buen principio de seguridad: *nunca confíes en una sola capa*.

### 0.2 — Por qué los dashboards de Restaurante y Repartidor se sienten "flojos" comparados con Admin

- `components/features/admin/AdminDashboardCharts.tsx` es el único de los tres que tiene: selector de granularidad (Día/Semana/Mes), rango de fechas validado, selects de filtro adicionales, y un estilo de barra con degradado (`linearGradient` lime→lime/violeta→violeta) + `ChartContainer`/`ChartTooltip` de shadcn.
- `components/features/restaurants/RestaurantDashboardCharts.tsx` es un **Server Component** que solo trae 7 días (ventas) y 30 días (top productos) fijos, sin filtros, y sus dos hijos (`DailySalesChart.tsx`, `TopProductsChart.tsx`) usan `var(--color-primary)` plano, sin degradado, sin `ChartTooltip` formateado igual que Admin.
- `components/features/deliveries/DeliveryDashboardCards.tsx` **no tiene ni un solo gráfico** — solo 4 `StatCard`. Es el panel más incompleto de los tres pese a que la data para graficarlo (`deliveries`, `orders`) ya existe y ya se consulta en `DeliveryHistoryTable.tsx`.

La solución no es "copiar y pegar" `AdminDashboardCharts.tsx` dos veces más (eso triplicaría ~150 líneas de lógica de fechas/agregación que después habría que mantener sincronizadas en 3 lugares). La solución correcta, y la única que justifica archivos nuevos en este plan, es **extraer las partes realmente compartidas** a un módulo y a un componente, y luego que Admin/Restaurante/Repartidor los consuman.

---

## Fase 1 — [CRÍTICO] Corregir fuga de productos y categorías entre restaurantes

**Objetivo:** un dueño de restaurante solo debe poder ver (y por tanto editar/borrar) los productos y categorías de **su propio** restaurante, nunca los de otro.

### 1.1 — Capa 1: corregir la policy de RLS (causa raíz)

No se debe editar `20260920201230_products_categories_customer_visibility.sql` directamente — es una migración ya aplicada en el proyecto vinculado (`pideloya`, ver `supabase/.temp/project-ref`); las migraciones en Supabase son *append-only* por diseño (si la editas, tu historial local y el remoto divergen y `supabase db push` puede fallar o generar drift). La forma correcta es una **migración nueva** que reemplace únicamente esas dos policies.

**Archivo nuevo, justificado:** `supabase/migrations/20260927000000_fix_products_categories_role_scope.sql`

> Es el único archivo verdaderamente obligatorio de todo este plan: es un bug de seguridad/aislamiento de datos a nivel de base de datos y **no existe forma de arreglarlo sin una migración nueva** sin tocar el historial ya aplicado.

```sql
-- ============================================================================
-- PideloYa — Fix: products_select_customer / categories_select_customer
-- no debían aplicar al rol RESTAURANT
-- ============================================================================
-- Bug: la migración 20260920201230 agregó estas dos policies para que el
-- CLIENTE autenticado viera el catálogo público, pero no excluyó al rol
-- RESTAURANT. Como las policies de SELECT se combinan con OR, un dueño de
-- restaurante (ya cubierto por products_select_owner/categories_select_owner)
-- terminaba viendo TAMBIÉN el catálogo completo de todos los restaurantes
-- aprobados y activos, incluidos los ajenos.
--
-- Fix: se agrega la condición "public.current_role() is distinct from
-- 'RESTAURANT'" — current_role() ya existe (rls_policies.sql) y es
-- SECURITY DEFINER, así que no dispara recursión ni RLS extra. Devuelve
-- NULL para anon (sin fila en profiles), lo cual "is distinct from" trata
-- como verdadero, así que el catálogo público para anon/cliente sigue
-- funcionando exactamente igual que antes.
-- ============================================================================

drop policy if exists "products_select_customer" on public.products;
create policy "products_select_customer"
on public.products for select
using (
  available = true
  and public.current_role() is distinct from 'RESTAURANT'
  and restaurant_id in (
    select id from public.restaurants where is_approved = true and is_active = true
  )
);

drop policy if exists "categories_select_customer" on public.categories;
create policy "categories_select_customer"
on public.categories for select
using (
  public.current_role() is distinct from 'RESTAURANT'
  and restaurant_id in (
    select id from public.restaurants where is_approved = true and is_active = true
  )
);
```

**Pasos:**
1. Crear el archivo de migración de arriba con `supabase migration new fix_products_categories_role_scope` (o el nombre equivalente que genere el timestamp correcto).
2. `supabase db push` contra el proyecto vinculado (`jtggpdqucheuovvcjqff`).
3. Regenerar `types/database.ts` si usas `supabase gen types` — en este caso no hace falta, la migración no agrega columnas ni tablas nuevas, solo reemplaza dos policies.

### 1.2 — Capa 2: defensa en profundidad en las queries del panel de restaurante

**Principio:** ninguna página del panel de restaurante debe depender *únicamente* de RLS para acotar los datos a "mi restaurante". Debe haber siempre un `.eq('restaurant_id', restaurantId)` explícito, igual que ya hacen correctamente `lib/actions/products.ts` y `lib/actions/categories.ts` en sus *mutaciones* (`getMyRestaurantId()`). Falta aplicar el mismo criterio a las *lecturas* de las páginas server component.

**Archivos existentes a modificar (sin crear archivos nuevos):**

#### a) `app/restaurante/productos/page.tsx`
- Hoy: `supabase.from('products').select(...).order('created_at', ...).range(...)` sin filtro de restaurante.
- Cambio: antes de la query, resolver el `restaurant_id` del usuario actual (mismo patrón ya usado en `app/restaurante/productos/nuevo/page.tsx`: `profiles` → `restaurant_members`), y agregar `.eq('restaurant_id', restaurantId)` tanto al `getCount` como a la query de `products`.
- Mismo tratamiento para el `getCount` (`supabase.from('products').select('id', { count: 'exact', head: true })`) — hoy tampoco filtra.

#### b) `app/restaurante/categorias/page.tsx`
- Hoy: `supabase.from('categories').select('id, name').order('sort_order', ...)` sin filtro.
- Cambio: resolver `restaurant_id` (mismo patrón) y agregar `.eq('restaurant_id', restaurantId)`.

#### c) `app/restaurante/productos/nuevo/page.tsx`
- Ya resuelve `member!.restaurant_id` para pasarlo al formulario, pero la query de `categories` para poblar el `<Select>` **no lo usa como filtro**:
  ```ts
  const { data: categories } = await supabase
    .from('categories')
    .select('id, name')
    .order('sort_order', { ascending: true })
  ```
- Cambio: agregar `.eq('restaurant_id', member!.restaurant_id)`.

#### d) `components/features/products/ProductEditDialog.tsx` / `ProductRowActions.tsx`
- Reciben `categories` como prop desde `app/restaurante/productos/page.tsx`. Una vez corregido (c), no necesitan cambios — pero conviene revisar que `app/restaurante/productos/page.tsx` también filtre la query de `categories` que usa para pasarlas a `ProductRowActions` (hoy: `supabase.from('categories').select('id, name').order('sort_order', ...)`, mismo bug, mismo fix que (b)).

#### e) Server Actions ya correctas (verificación, sin cambios)
- `lib/actions/products.ts::createProduct/updateProduct/deleteProduct` → usan `getMyRestaurantId()` + confían en `products_update_owner`/`products_delete_owner` (que sí están correctamente acotadas a `current_restaurant_ids()`, nunca tuvieron el bug). **No requieren cambios.**
- `lib/actions/categories.ts` → mismo caso, ya correcto.
- Esto confirma que el bug era **solo de lectura en las páginas listado**, nunca de escritura — un restaurante nunca pudo *editar* el producto de otro, solo *verlo* listado. Igual es un bug serio (fuga de información comercial entre competidores en la misma plataforma).

### 1.3 — Checklist de aceptación de la Fase 1

- [ ] Crear dos restaurantes de prueba, A y B, cada uno con ≥2 productos y ≥2 categorías propias.
- [ ] Iniciar sesión como dueño de A → `/restaurante/productos` muestra **solo** los productos de A.
- [ ] Iniciar sesión como dueño de A → `/restaurante/categorias` muestra **solo** las categorías de A.
- [ ] Iniciar sesión como dueño de A → `/restaurante/productos/nuevo` → el `<Select>` de categorías muestra **solo** las de A.
- [ ] El catálogo público (`/(public)/restaurantes/[slug]`, `/cliente/restaurantes/[slug]`, home de cliente) sigue mostrando productos/categorías de **todos** los restaurantes aprobados y activos — la Fase 1 no debe romper la visibilidad pública para clientes.
- [ ] Un cliente sin sesión (anon) sigue viendo el catálogo público sin cambios.
- [ ] El admin (`adminClient()` en `app/api/v1/products/*`, `app/api/v1/categories/*`) sigue viendo todo (usa `products_all_admin`/`categories_all_admin`, no afectadas por este fix).
- [x] `pnpm run typecheck` y `pnpm run lint` sin errores nuevos en los archivos tocados.

### 1.4 — Resultado de la ejecución (2026-09-26)

**Verificado automáticamente:**
- Migración aplicada al proyecto vinculado; `db push --dry-run` posterior: "Remote database is up to date".
- `tsc --noEmit` limpio, `eslint` limpio en los 3 archivos tocados, `next build` exitoso (`/restaurante/*` siguen siendo rutas dinámicas `ƒ`).
- Lectura de las policies en el repo confirmada: `products_select_customer` / `categories_select_customer` (migración `20260920201230`) efectivamente no filtraban por rol, y `products_select_public` / `categories_select_public` ya estaban correctamente limitadas a `auth.role() = 'anon'` desde `20260912000000`.
- `app/api/v1/products/*` y `app/api/v1/categories/*` ya acotaban el rol `RESTAURANT` con `restaurant_members` + `.in('restaurant_id', ids)` sobre `adminClient()`, así que no requirieron cambios (coincide con 1.2.e).

**Implementado:**
- `app/restaurante/productos/page.tsx`: resuelve `restaurantId` (profiles → restaurant_members) y agrega `.eq('restaurant_id', restaurantId)` al `getCount`, a la query de `products` y a la de `categories` que alimenta a `ProductRowActions`. Si el usuario no tiene restaurante, `redirect('/restaurante')` (mismo patrón que `app/restaurante/horarios/page.tsx`).
- `app/restaurante/categorias/page.tsx`: mismo guard + `.eq('restaurant_id', restaurantId)` en la query de categorías.
- `app/restaurante/productos/nuevo/page.tsx`: `.eq('restaurant_id', member!.restaurant_id)` en la query que puebla el `<Select>`.
- Comentarios en los 3 archivos explicando *por qué* el filtro explícito existe (la policy pública sin condición de rol), para que nadie lo borre como "redundante con RLS".

**Pendiente (QA manual, requiere sesión):** los 6 primeros ítems del checklist 1.3 — dos restaurantes de prueba A/B, verificación de listados, Select de categorías y catálogo público para cliente anon/autenticado.

**Nota de endurecimiento posterior (2026-09-26):** la 1.1 excluía solo a `RESTAURANT`, lo que dejaba el catálogo visible para cualquier otro rol con sesión (hoy `DELIVERY`, y cualquier rol futuro). Se agregó y se aplicó la migración `20260927000100_catalog_policies_role_allowlist.sql`, que invierte la condición a una **allowlist explícita**: `auth.role() = 'anon'` o `public.current_role() in ('CUSTOMER', 'ADMIN')`. Estado final de ambas policies: `((auth.role() = 'anon' or public.current_role() in ('CUSTOMER','ADMIN')) and [available = true and] restaurant_id in (select id from restaurants where is_approved and is_active))`. `DELIVERY` queda fuera a propósito: el panel de reparto no lee `products`/`categories` (verificado: usa `order_items.product_name`/`image_url` como snapshot), así que no se rompe ningún flujo. La condición de allowlist también cierra el caso de una sesión autenticada sin fila en `profiles` (fail closed).

---

## Fase 2 — Extraer primitivas compartidas de dashboard

**Objetivo:** que Admin, Restaurante y Repartidor compartan literalmente el mismo código para (a) el selector Día/Semana/Mes + rango de fechas con su validación, (b) la función de agregación en "buckets" fijos, y (c) el estilo visual de las barras (degradado lime/violeta + tooltip). Hoy todo eso vive **solo** dentro de `components/features/admin/AdminDashboardCharts.tsx`, mezclado con lógica específica de Admin (selects de restaurante/repartidor).

### 2.1 — Archivo nuevo, justificado: `lib/dashboard/chart-utils.ts`

> Justificación: `AdminDashboardCharts.tsx` ya tiene ~150 líneas de lógica de fechas/agregación (`Granularity`, `RangeError`, `RANGE_ERROR_TEXT`, `FIXED_BUCKETS`, `bucketKeyFor`, `buildBuckets`, `aggregate`, la validación de rango con `RANGE_MAX_DAYS`). Copiarla dos veces más (Restaurante, Repartidor) es exactamente el tipo de duplicación que después causa bugs de fechas sutiles (recordemos que este mismo proyecto ya tuvo bugs de timezone Lima documentados en `lib/dates.ts`). Extraerla una sola vez a un módulo puro de utilidades (sin JSX, sin estado de React) es la opción de menor riesgo y la que evita divergencia futura. No crea una nueva pantalla ni una nueva feature — es refactor puro.

Contenido (mover tal cual desde `AdminDashboardCharts.tsx`, sin cambiar comportamiento):
```ts
// lib/dashboard/chart-utils.ts
import { DAY_MS, RANGE_MAX_DAYS, WEEKDAYS_FULL, MONTHS_FULL, dayParts, limaDayKey } from '@/lib/dates'

export type Granularity = 'day' | 'week' | 'month'
export type RangeError = 'empty-from' | 'empty-to' | 'inverted' | 'too-long' | null

export const RANGE_ERROR_TEXT: Record<Exclude<RangeError, null>, string> = { /* ...igual que hoy... */ }

export const GRANULARITY_OPTIONS = [
  { key: 'day' as const, label: 'Día' },
  { key: 'week' as const, label: 'Semana' },
  { key: 'month' as const, label: 'Mes' },
]

export type Bucket = { key: string; label: string; count: number; total: number }

const FIXED_BUCKETS: Record<Granularity, { key: string; label: string }[]> = { /* ...igual... */ }

export function bucketKeyFor(createdAt: string, granularity: Granularity): string { /* ...igual... */ }
export function buildBuckets(granularity: Granularity, counts: Map<string, { count: number; total: number }>): Bucket[] { /* ...igual... */ }
export function aggregateOrders<T extends { created_at: string; total: number }>(
  orders: T[],
  granularity: Granularity
): Bucket[] { /* ...igual, generaliza el tipo de "order" para reusar con subsets de columnas... */ }

export function validateDateRange(dateFrom: string, dateTo: string): RangeError { /* ...igual, extraído del useMemo actual... */ }
```

**Cambio en `AdminDashboardCharts.tsx`:** eliminar las definiciones locales de `Granularity`, `RangeError`, `RANGE_ERROR_TEXT`, `GRANULARITY_OPTIONS`, `FIXED_BUCKETS`, `bucketKeyFor`, `buildBuckets`, `aggregate` y el bloque `useMemo` de `rangeError`, reemplazándolos por imports desde `@/lib/dashboard/chart-utils` (usando `validateDateRange` en vez del `useMemo` inline). **Cero cambio de comportamiento visible en Admin** — es un refactor de extracción, no una reescritura.

### 2.2 — Archivo nuevo, justificado: `components/features/dashboard/DashboardRangeFilterBar.tsx`

> Justificación: el bloque JSX del filtro (pills de granularidad + dos `<Input type="date">` + mensaje de error) se repite visualmente en Admin y se necesita idéntico en Restaurante y Repartidor. Es la barra de controles, no un gráfico — separarla de `AdminDashboardCharts.tsx` permite que cada dashboard le pase sus propios selects adicionales (Admin: restaurante/repartidor; Restaurante y Repartidor: ninguno) vía `children`, sin duplicar el layout ni la validación.

```tsx
// components/features/dashboard/DashboardRangeFilterBar.tsx
'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CalendarIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  GRANULARITY_OPTIONS,
  RANGE_ERROR_TEXT,
  type Granularity,
  type RangeError,
} from '@/lib/dashboard/chart-utils'

export function DashboardRangeFilterBar({
  granularity,
  onGranularityChange,
  dateFrom,
  dateTo,
  onDateFromChange,
  onDateToChange,
  rangeError,
  children, // selects extra (ej. Admin: restaurante/repartidor)
}: {
  granularity: Granularity
  onGranularityChange: (g: Granularity) => void
  dateFrom: string
  dateTo: string
  onDateFromChange: (v: string) => void
  onDateToChange: (v: string) => void
  rangeError: RangeError
  children?: React.ReactNode
}) {
  const fromInvalid = rangeError === 'empty-from' || rangeError === 'inverted' || rangeError === 'too-long'
  const toInvalid = rangeError === 'empty-to' || rangeError === 'inverted' || rangeError === 'too-long'

  return (
    <div className="flex flex-wrap items-end gap-x-6 gap-y-3 rounded-2xl border bg-muted/30 p-4">
      <div>
        <Label className="mb-1.5 block text-xs font-medium">Vista</Label>
        <div className="inline-flex items-center gap-1 rounded-full bg-muted p-1">
          {GRANULARITY_OPTIONS.map((option) => {
            const active = granularity === option.key
            return (
              <button
                key={option.key}
                type="button"
                aria-pressed={active}
                onClick={() => onGranularityChange(option.key)}
                className={cn(
                  'rounded-full px-3 py-1 text-sm font-medium transition-colors',
                  active ? 'bg-lime text-[#0C0C0E] shadow-sm' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {option.label}
              </button>
            )
          })}
        </div>
      </div>

      <div className="space-y-1">
        <Label htmlFor="filter-from" className="text-xs font-medium">Desde</Label>
        <div className="relative">
          <CalendarIcon className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input id="filter-from" type="date" className="w-40 pl-8" value={dateFrom} max={dateTo || undefined} aria-invalid={fromInvalid} onChange={(e) => onDateFromChange(e.target.value)} />
        </div>
      </div>

      <div className="space-y-1">
        <Label htmlFor="filter-to" className="text-xs font-medium">Hasta</Label>
        <div className="relative">
          <CalendarIcon className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input id="filter-to" type="date" className="w-40 pl-8" value={dateTo} min={dateFrom || undefined} aria-invalid={toInvalid} onChange={(e) => onDateToChange(e.target.value)} />
        </div>
      </div>

      {children}

      {rangeError && (
        <p role="alert" className="text-xs text-destructive">
          {RANGE_ERROR_TEXT[rangeError]}
        </p>
      )}
    </div>
  )
}
```

**Cambio en `AdminDashboardCharts.tsx`:** reemplazar el `<div className="flex flex-wrap items-end ...">` completo (controles) por `<DashboardRangeFilterBar granularity={granularity} ... >{/* selects de restaurante/repartidor van aquí como children, o se quedan fuera y se renderizan en el header de cada <Card> como ya está hoy */}</DashboardRangeFilterBar>`. Los selects de restaurante/repartidor de Admin **no** se mueven — siguen viviendo en el `<CardHeader>` de cada gráfico exactamente como hoy, porque son selects *por gráfico*, no del rango global.

### 2.3 — Estilo de gráfico compartido (sin extraer a componente, solo documentar el patrón)

No propongo extraer el `<BarChart>` en sí a un componente genérico — Recharts + `ChartContainer` ya son suficientemente declarativos y cada dashboard tiene 1-2 gráficos con leves diferencias (orientación, dataKey). Extraerlo forzaría una API de props genérica que terminaría siendo más compleja que repetir ~25 líneas de JSX. En su lugar, la Fase 3 y 4 **copian el patrón visual exacto** de Admin (ver 2.4) directamente en los componentes ya existentes de Restaurante/Repartidor — esto es una decisión consciente de "no sobre-abstraer" (best practice de Vercel: preferir duplicación pequeña y legible sobre una abstracción prematura de 3 usos).

**Patrón visual a replicar en Fases 3 y 4** (tomado literalmente de `AdminDashboardCharts.tsx`):
```tsx
<defs>
  <linearGradient id="<id-unico>" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stopColor="var(--color-count)" stopOpacity={1} />
    <stop offset="100%" stopColor="var(--color-count)" stopOpacity={0.55} />
  </linearGradient>
</defs>
...
<Bar dataKey="count" radius={[6, 6, 0, 0]} fill="url(#<id-unico>)" />
```
con `chartConfig = { count: { label: '...', color: 'var(--color-lime)' } }` para el gráfico "principal" de cada panel y `'var(--color-violet)'` para el secundario — exactamente los dos colores que usa Admin (`salesConfig`/`deliveriesConfig`), en vez del `var(--color-primary)` naranja que usa hoy Restaurante.

### 2.4 — Checklist de aceptación de la Fase 2

- [ ] `AdminDashboardCharts.tsx` se ve y se comporta **exactamente igual** que antes del refactor (mismo pixel, misma validación) — esta fase es invisible para el usuario final de Admin. *(Equivalencia verificada por revisión línea a línea del código extraído; la comprobación visual con sesión de admin queda pendiente.)*
- [x] `pnpm run typecheck` sin errores tras mover los tipos `Granularity`/`RangeError`/`Bucket` a `lib/dashboard/chart-utils.ts`.
- [x] No queda ninguna definición duplicada de `FIXED_BUCKETS`/`bucketKeyFor`/`aggregate` en `AdminDashboardCharts.tsx`.

### 2.5 — Resultado de la ejecución (2026-09-26)

**`lib/dashboard/chart-utils.ts`** (módulo puro, sin JSX ni estado): `Granularity`, `RangeError`, `RANGE_ERROR_TEXT`, `GRANULARITY_OPTIONS`, `Bucket`, `bucketKeyFor`, `buildBuckets`, `aggregateOrders<T extends { created_at: string; total: number }>`, `validateDateRange` — todos movidos literalmente desde `AdminDashboardCharts.tsx`.

**Export extra añadido:** `filterByRange<T extends { created_at: string }>(rows, dateFrom, dateTo)` — extrae el filtro de `spanOrders` (límites `T00:00:00-05:00` / `T23:59:59-05:00`, inclusivo, calculados una sola vez por llamada). Se agregó aquí, y no en las fases 3/4, porque es exactamente la misma lógica de zona horaria Lima que Restaurante y Repartidor necesitan: tenerla una sola vez evita el tipo de bug que ya documenta `lib/dates.ts`.

**`components/features/dashboard/DashboardRangeFilterBar.tsx`**: barra controlada (pills Día/Semana/Mes + `Desde`/`Hasta` + `role="alert"`) con `children` opcional para selects por panel. Markup, clases e ids (`filter-from`/`filter-to`) idénticos a los que tenía Admin; `aria-invalid` solo en el campo culpable según `RangeError`. Vive en `components/features/dashboard/` junto a `StatCard.tsx`, el otro primitivo compartido por los tres paneles.

**`AdminDashboardCharts.tsx`**: pasa de 402 a 265 líneas. Elimina las definiciones locales extraídas y los imports que solo servían a la barra (`Input`, `Label`, `cn`, `CalendarIcon`, `DAY_MS`, `RANGE_MAX_DAYS`, `WEEKDAYS_FULL`, `MONTHS_FULL`, `dayParts`, `limaDayKey`); de `@/lib/dates` solo conserva `addDays` (default `dateFrom`). El `useMemo` de `rangeError` ahora es `validateDateRange(dateFrom, dateTo)` y `spanOrders` es `filterByRange(orders, dateFrom, dateTo)`. Se mantienen intactos los selects de restaurante/repartidor en el `CardHeader` de cada gráfico (son por gráfico, no del rango global), los dos `chartConfig` (lime/violeta), los degradados (`salesBarGradient`/`deliveriesBarGradient`), `accessibilityLayer` y los estados vacíos.

---

## Fase 3 — Dashboard de Restaurante: filtros + restyle visual

**Archivos a modificar (existentes, sin crear archivos nuevos aparte de los ya justificados en la Fase 2):**
`app/restaurante/page.tsx`, `components/features/restaurants/RestaurantDashboardCharts.tsx`, `components/features/restaurants/DailySalesChart.tsx`, `components/features/restaurants/TopProductsChart.tsx`.

### 3.1 — Cambiar el patrón de data-fetching para que soporte rango arbitrario

Hoy `RestaurantDashboardCharts` es un **Server Component** que trae datos ya acotados a 7/30 días fijos y los pasa pre-agregados a sus hijos client component (`DailySalesChart`, `TopProductsChart` son `'use client'` solo para Recharts, pero no filtran nada).

Para soportar Día/Semana/Mes + rango de fechas (igual que Admin, que trae **todo** el histórico server-side y filtra/agrega en cliente), el cambio es:

1. **`app/restaurante/page.tsx`** (hoy sincrónico y sin fetch de datos) pasa a ser `async` y trae, server-side:
   - `orders` — **sin** filtro explícito de restaurante es intencional aquí: la policy `orders_select_restaurant_readonly` ya acota a "pedidos que incluyen productos de mi restaurante" para el rol `RESTAURANT`. Aun así, por el mismo principio de defensa en profundidad aprendido en la Fase 1, se debe unir con `order_items` para poder filtrar explícitamente. Patrón recomendado (mismo que ya usa `RestaurantDashboardCharts.tsx` hoy para `order_items`):
     ```ts
     const { restaurantId } = await getMyRestaurantId(supabase) // extraer este helper (ver 3.2)
     const { data: orderItems } = await supabase
       .from('order_items')
       .select('order_id, unit_price, quantity, created_at, restaurant_id')
       .eq('restaurant_id', restaurantId)
       .gte('created_at', /* hoy - RANGE_MAX_DAYS días, en vez de 8/30 fijos */)
     ```
   - Con `order_items` ya trae `unit_price`/`quantity`/`created_at`, no hace falta un segundo query a `orders` para el gráfico de ventas — se agrega usando `unit_price * quantity` por línea, igual que ya hace `RestaurantDashboardCards.tsx`/`DailySalesChart.tsx` hoy. Para el gráfico de "productos más vendidos" se reutiliza el mismo `order_items` (ya trae `product_name`/`quantity` — agregar esas columnas al `select`).
   - Esto **reduce** el número de queries respecto a la versión actual (que hoy hace 2 queries separadas con rangos distintos) a **una sola query** con el rango máximo (`RANGE_MAX_DAYS` = 366 días, mismo límite que Admin), y el filtrado por fecha/granularidad ocurre en cliente — exactamente el mismo modelo mental que `app/admin/page.tsx` → `AdminDashboardCharts`.

2. **`getMyRestaurantId`** ya existe como función local duplicada en `lib/actions/products.ts`, `lib/actions/categories.ts`, `lib/actions/restaurants.ts`, `lib/actions/restaurant-hours.ts`, y como variante `getMyRestaurantId(supabase)` en `components/features/restaurants/RestaurantDashboardCards.tsx`. **No se extrae en este plan** (fuera de alcance — es un problema de duplicación preexistente, no introducido por esta feature; extraerlo tocaría 5 archivos sin relación con el pulido visual pedido). Para `app/restaurante/page.tsx` se replica el mismo patrón corto de 3 líneas que ya usa `RestaurantDashboardCards.tsx`.

3. **`RestaurantDashboardCharts.tsx`** deja de ser Server Component: pasa a ser `'use client'` y recibe `orderItems` (ya trae hasta 366 días) como prop desde `app/restaurante/page.tsx`. Internamente:
   - Usa `useState` para `granularity`, `dateFrom`, `dateTo` (con default `dateFrom = addDays(todayKey, -29)`, `dateTo = todayKey`, igual que Admin).
   - Usa `validateDateRange` de `lib/dashboard/chart-utils.ts` (Fase 2).
   - Filtra `orderItems` por rango de fechas, agrupa por `order_id` para reconstruir el "total por pedido" cuando haga falta, y llama `aggregateOrders` para el gráfico de ventas.
   - Para "top productos" agrega por `product_name` dentro del mismo rango filtrado (en vez del rango fijo de 30 días actual).
   - Renderiza `<DashboardRangeFilterBar granularity={...} .../>` (Fase 2) **sin** children extra (Restaurante no necesita selects adicionales).

### 3.2 — Restyle de `DailySalesChart.tsx` y `TopProductsChart.tsx`

- Cambiar `chartConfig` de `{ total: { label: 'Ventas', color: 'var(--color-primary)' } }` a `{ count: { label: 'Ventas', color: 'var(--color-lime)' } }` — nota: cambia de graficar `total` (suma S/) a `count` (nº de buckets con `total` como tooltip secundario) para ser consistente con cómo Admin construye sus `Bucket` (`{ count, total }`); el tooltip puede seguir mostrando el monto en soles usando `formatter` como ya hace hoy `ChartTooltipContent` con `formatter={(value) => ["S/ " + ..., 'Ventas']}`.
- Agregar el `<defs><linearGradient>` del patrón 2.3, con `id="restaurantSalesGradient"` (único, distinto al de Admin, para no chocar si ambos componentes llegaran a montarse en el mismo árbol de SSR/RSC — buena práctica de Recharts con IDs de `<defs>`).
- `TopProductsChart.tsx`: mismo tratamiento, pero con `var(--color-violet)` (el segundo color de la paleta de Admin, para diferenciar visualmente "Ventas" de "Top productos" igual que Admin diferencia "Ventas" de "Entregas").
- Mantener el estado vacío (`Sin productos vendidos en los últimos 30 días.`) pero actualizar el texto a algo dinámico según el rango activo (ej. `Sin ventas en el período seleccionado.`), igual que el `salesEmptyMessage`/`deliveriesEmptyMessage` de Admin.

### 3.3 — Checklist de aceptación de la Fase 3

- [x] `/restaurante` muestra la misma barra de filtros (Día/Semana/Mes + rango) que `/admin`, con el mismo look & feel. *(Es literalmente `DashboardRangeFilterBar`, la misma pieza que usa Admin.)*
- [x] Cambiar el rango de fechas actualiza ambos gráficos sin recargar la página (todo client-side, sin round-trip al servidor). *(El server component hace UNA query con el rango máximo y el cliente filtra/agrega con `filterByRange`/`aggregateOrders`.)*
- [x] Los gráficos usan degradado lime/violeta en vez del naranja `--color-primary` actual. *(`restaurantSalesGradient` lime, `restaurantTopProductsGradient` violeta.)*
- [x] Un restaurante sin ventas en el rango elegido ve el mismo tipo de estado vacío con ícono que ya usa Admin (`BarChart3Icon` para ventas, `PackageOpenIcon` para productos) con el mismo tamaño/opacidad (`h-8 w-8 text-muted-foreground/40`) y mensaje dinámico (`No hay ventas en el período seleccionado.` / `Corrige el rango de fechas para ver los gráficos.`).
- [ ] El restaurante **solo** ve datos de sus propios pedidos (verificar con dos restaurantes de prueba, mismo criterio que en la Fase 1). *(Garantizado por RLS `order_items_select_restaurant` + el `.eq('restaurant_id', restaurantId)` explícito; falta la comprobación manual.)*
- [x] No se rompe `RestaurantDashboardCards.tsx` (los 4 `StatCard` de arriba) — sigue funcionando igual, es un componente aparte. *(No se tocó.)*

### 3.4 — Resultado de la ejecución (2026-09-26)

**`app/restaurante/page.tsx`** ahora es `async`: resuelve `restaurantId` (profiles → restaurant_members) y trae, en **una sola query** (antes eran dos con rangos fijos de 8 y 30 días), las líneas de `order_items` de hasta `RANGE_MAX_DAYS` = 366 días con `.eq('restaurant_id', …)` explícito (defensa en profundidad, mismo criterio de la Fase 1) + `.order('created_at', desc).limit(5000)` para que el tope recorte lo más viejo y nunca lo reciente. El rango se calcula desde `todayKey` (snapshot de Lima), no desde el reloj del navegador, y la ventana arranca en medianoche de Lima: `new Date(`${addDays(todayKey, -366)}T00:00:00-05:00`)`.

**`RestaurantDashboardCharts.tsx`** pasa de server component a `'use client'`: recibe `orderItems` + `todayKey`, mantiene `granularity`/`dateFrom`/`dateTo` en `useState` (default: últimos 30 días, igual que Admin), valida con `validateDateRange`, filtra con `filterByRange` y agrega con `aggregateOrders`. Exporta el tipo `DashboardOrderItem` que consume la página.

**`DailySalesChart.tsx`**: pasa de `AreaChart` naranja a `BarChart` lime con degradado, `accessibilityLayer`, ejes y tooltip con el mismo layout que Admin.

**`TopProductsChart.tsx`**: violeta con degradado horizontal (`radius [0,6,6,0]`), mismo estado vacío con ícono.

**Decisión documentada (desviación consciente de 3.2):** el gráfico "Ventas" sigue midiendo **S/ (`total`)** en la barra y no `count`. El plan proponía graficar `count` "para ser consistente con Admin", pero en Admin `count` es *número de pedidos* mientras que aquí `count` sería *número de ítems vendidos*: usarlo habría cambiado la métrica del gráfico principal del restaurante de soles a unidades, sin que el título (`Ventas`) deje de prometer soles. Se conserva entonces la consistencia que importa —mismos primitivos, mismos `Bucket` con `count` y `total`, mismo lenguaje visual, mismo tooltip— y el número de ítems del bucket aparece en el tooltip (`miércoles · 8 ítems`). Cambiar la métrica es una decisión de producto, no de estilo: si se prefiere graficar unidades, es un cambio de una línea (`dataKey`/`chartConfig`).

**Títulos:** `Ventas` y `Productos más vendidos`, sin el "(últimos 7 días)"/"(30 días)" hardcodeado — el período lo comunica la barra de filtros, igual que en Admin.

**Verificado:** `tsc --noEmit`, `eslint` (0 errores/0 warnings en los 4 archivos) y `next build` limpios. Ojo: `react-hooks/purity` (regla del compilador de React que trae este repo) rechaza `Date.now()` dentro de un componente, por eso la ventana se deriva de `todayKey` con `addDays` y no de `Date.now()`.

---

## Fase 4 — Dashboard de Repartidor: agregar gráficos

**Archivo nuevo, justificado:** `components/features/deliveries/DeliveryDashboardCharts.tsx`

> Justificación: siguiendo exactamente el patrón arquitectónico que el propio proyecto ya estableció dos veces (Admin separa `DashboardCards.tsx` de `AdminDashboardCharts.tsx`; Restaurante separa `RestaurantDashboardCards.tsx` de `RestaurantDashboardCharts.tsx`), Repartidor necesita su `DeliveryDashboardCharts.tsx` porque **hoy no existe ningún archivo de gráficos para este panel** — no hay nada que "editar en su lugar". Crear un archivo nuevo aquí no es preferencia estética, es completar un patrón que el propio código ya usa dos veces y que evita mezclar dos responsabilidades (cards con SWR+Realtime vs. gráficos con filtro de rango) en un solo archivo gigante.

**Archivos existentes a modificar:** `app/repartidor/page.tsx` (para montar el nuevo componente), y opcionalmente `components/features/deliveries/DeliveryDashboardCards.tsx` (sin cambios de lógica, solo si se decide compartir el fetch — ver 4.1).

### 4.1 — Decisión de arquitectura de datos: Server Component (como Admin/Restaurante), no SWR

`DeliveryDashboardCards.tsx` usa hoy `'use client'` + `useSWR` + `useRealtimeInvalidate` (arquitectura distinta a Admin/Restaurante). Para los **gráficos** de la Fase 4 se recomienda **no** replicar el patrón SWR de las cards, sino seguir el patrón Server Component + filtro client-side que ya usan Admin y (tras la Fase 3) Restaurante — por dos razones:
1. Consistencia: los tres dashboards deben sentirse iguales; si Repartidor usa SWR para los gráficos, el rango de fechas tendría que refetchear por red en cada cambio de filtro en vez de filtrar en memoria, y sería el único de los tres con ese comportamiento.
2. Las tarjetas (`DeliveryDashboardCards.tsx`) necesitan tiempo real (un pedido se acepta/entrega y el número debe cambiar al instante) — los **gráficos históricos** no lo necesitan con la misma urgencia (Admin y Restaurante tampoco tienen realtime en sus gráficos, solo en sus cards vía `RealtimeRefresh`). Se mantiene esa misma asimetría intencional.

**`app/repartidor/page.tsx`** pasa de ser un componente síncrono a `async`:
```tsx
export default async function RepartidorHomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('profiles').select('id').eq('auth_id', user!.id).single()

  // deliveries + orders del repartidor actual, hasta RANGE_MAX_DAYS atrás.
  // Mismo patrón exacto que DeliveryHistoryTable.tsx, sin paginación (se trae
  // todo el rango para agregar en cliente, como Admin/Restaurante).
  const { data: deliveries } = await supabase
    .from('deliveries')
    .select('accepted_at, delivered_at, orders(status, total, created_at)')
    .eq('delivery_person_id', profile!.id)
    .order('accepted_at', { ascending: false })

  return (
    <PageContainer size="lg">
      <PageHeader title="Panel de reparto" description="..." />
      <div className="mt-6 space-y-6">
        <DeliveryDashboardCards />
        <DeliveryDashboardCharts deliveries={deliveries ?? []} />
      </div>
    </PageContainer>
  )
}
```

### 4.2 — `DeliveryDashboardCharts.tsx` (contenido)

Mismo esqueleto que `RestaurantDashboardCharts.tsx` tras la Fase 3 (client component, `useState` de granularidad/rango, `validateDateRange`, `DashboardRangeFilterBar` sin children extra), con **dos gráficos**, replicando 1:1 el segundo gráfico de Admin ("Entregas de repartidores") pero ya pre-filtrado a "mí mismo" (sin necesidad de un `<Select>` de repartidor, porque en este panel el repartidor siempre es el usuario actual):

1. **"Entregas completadas"** — `aggregateOrders` sobre `deliveries.filter(d => d.orders?.status === 'DELIVERED')`, color `var(--color-violet)` (mismo color que usa Admin para "Entregas de repartidores" — coherencia semántica: violeta = entregas en todo el proyecto).
2. **"Ingresos generados"** (opcional, alto valor para el repartidor) — si `total` de la orden se interpreta como el valor del pedido entregado, este gráfico le da al repartidor una noción de "cuánto valor movió", usando `var(--color-lime)` (lime = valor monetario, mismo criterio que "Ventas" en Admin/Restaurante). Si se prefiere no exponer montos de pedidos ajenos al repartidor por policy de negocio, omitir este segundo gráfico y dejar solo el de "Entregas completadas" a ancho completo.

Estado vacío: reutilizar el mismo texto/ícono que ya usa `DeliveryHistoryTable.tsx` para el caso "sin entregas" (`HistoryIcon`, "Todavía no tienes entregas en tu historial").

### 4.3 — Checklist de aceptación de la Fase 4

- [x] `/repartidor` muestra ahora la misma barra de filtros Día/Semana/Mes + rango que Admin y Restaurante. *(Es la misma pieza, `DashboardRangeFilterBar`.)*
- [ ] El gráfico de "Entregas completadas" solo cuenta entregas del repartidor autenticado (verificar con dos repartidores de prueba). *(Garantizado por la policy `deliveries_select_delivery` + el `.eq('delivery_person_id', profileId)` explícito; falta la comprobación manual.)*
- [x] El estilo visual (colores, degradados, `ChartTooltip`) es indistinguible del de Admin/Restaurante salvo por el dato mostrado.
- [x] `DeliveryDashboardCards.tsx` (las 4 tarjetas) sigue funcionando exactamente igual, sin tocar su lógica de SWR/Realtime. *(No se tocó ni una línea.)*
- [x] `pnpm run typecheck`/`lint` limpios.

### 4.4 — Resultado de la ejecución (2026-09-26)

**Arquitectura (4.1):** se siguió el patrón Server Component + filtro en cliente, **no** el SWR de las tarjetas. `DeliveryDashboardCards.tsx` conserva su `useSWR` + `useRealtimeInvalidate` (un pedido que se acepta o se entrega debe refrescar las tarjetas al instante); los gráficos históricos no necesitan esa urgencia, exactamente la misma asimetría que ya tienen Admin y Restaurante.

**`app/repartidor/page.tsx`** pasa a `async`: resuelve `profileId` (profiles → `auth_id`) y trae, en una sola query, las entregas de hasta `RANGE_MAX_DAYS` (366 días) con `delivered_at` no nulo, `.eq('delivery_person_id', profileId)` explícito y `.order('delivered_at', desc).limit(5000)`. Se filtra por `delivered_at` (`.gte`) en el servidor y se exige `orders.status = 'DELIVERED'` en el cliente, así que las entregas activas o canceladas no entran a los gráficos.

**`components/features/deliveries/DeliveryDashboardCharts.tsx`** (archivo nuevo, justificado en el plan): client component con `DashboardRangeFilterBar` + dos tarjetas que consumen **los mismos buckets**: "Entregas completadas" grafica `count` en violeta (el color que Admin usa para entregas) e "Ingresos generados" grafica `total` en lime (el color del dinero), con degradados `deliveryCountGradient`/`deliveryRevenueGradient`.

**Decisión: el gráfico de ingresos se implementó (no se omitió).** El plan lo dejaba como opcional "si se prefiere no exponer montos de pedidos ajenos al repartidor". No expone nada nuevo: `DeliveryOrderCard` ya muestra `S/ {total}` en Disponibles y en Mis entregas, y `app/repartidor/pedidos/[id]` muestra el total del pedido. El dato ya está en pantalla.

**Decisiones pequeñas (documentadas por si se quieren revertir):**
- El bucket se calcula por **`delivered_at`**, no por el `created_at` del pedido: para el repartidor el hecho relevante es cuándo entregó. Se adapta al tipo de `aggregateOrders` (`{ created_at, total }`) porque ese nombre es el campo que agrupa, no el alta del pedido.
- Estados vacíos con `TruckIcon` (entregas) y `BarChart3Icon` (ingresos) — el mismo mapeo ícono↔semántica que usa Admin — en vez del `HistoryIcon` de `DeliveryHistoryTable`, y mensaje dinámico (`No hay entregas en el período seleccionado.` / `Corrige el rango de fechas…`). El texto de la tabla de historial ("Todavía no tienes entregas en tu historial") sería **incorrecto** con un filtro estrecho: puede haber historial y simplemente nada en ese rango.
- `PageContainer size="lg"` (`max-w-4xl`) se dejó como estaba: los gráficos a dos columnas entran en ~430px cada uno. Si se quieren más anchos, es el punto 1 de la Fase 5 (`size="full"`, como Admin y Restaurante).

**Verificado:** `tsc --noEmit`, `eslint` (0 errores/0 warnings en los archivos tocados) y `next build` (con `/repartidor` todavía dinámica) limpios.

---

## Fase 5 — Auditoría de consistencia visual final

Pulido final, de bajo riesgo, para que los tres paneles se sientan hechos por el mismo equipo el mismo día:

1. **Spacing y contenedor:** confirmar que `app/repartidor/page.tsx` usa `<PageContainer size="lg">` igual que `app/admin/page.tsx` (Admin usa `size="full"` en su página — decidir si Repartidor/Restaurante deben pasar a `"full"` también ahora que tienen gráficos anchos de 2 columnas; hoy Restaurante ya usa grid `lg:grid-cols-2` dentro de un contenedor que no está limitado, verificar en `RestaurantDashboardCharts.tsx` que no herede un `max-w-4xl` innecesario de `PageContainer size="lg"` que comprima los gráficos).
2. **Iconografía de estados vacíos:** unificar en los tres paneles el uso de `lucide-react` con el mismo tamaño (`h-8 w-8 text-muted-foreground/40`) — ya es el estándar de Admin, replicarlo en los nuevos estados vacíos de Restaurante/Repartidor de la Fase 3/4.
3. **`Card` header:** confirmar que los `<CardTitle>` de los nuevos/actualizados gráficos usan el mismo patrón de "punto de color + texto" que Admin (`<span className="h-2 w-2 rounded-full bg-lime" aria-hidden /> Ventas`) en vez del texto plano que usa hoy `DailySalesChart.tsx`/`TopProductsChart.tsx`.
4. **Accesibilidad:** verificar `accessibilityLayer` en los `<BarChart>`/`<AreaChart>` nuevos (Admin ya lo usa; Restaurante hoy también lo usa; confirmar que se mantiene tras el refactor de la Fase 3, y agregarlo en los `<BarChart>` nuevos de la Fase 4).
5. **Reduced motion:** el proyecto ya respeta `prefers-reduced-motion` globalmente en `app/globals.css` — no requiere cambios, solo verificar que ningún gráfico nuevo introduzca animaciones CSS propias fuera de las de Recharts (que ya respetan el media query del navegador vía Framer-less transiciones nativas de SVG).

Esta fase no tiene archivos "nuevos" — es una pasada de QA visual sobre los archivos ya tocados en las Fases 3 y 4.

---

## Fase 6 — QA, checklist de regresión y orden de despliegue

### 6.1 — Orden de despliegue recomendado

1. **Migraciones de la Fase 1 primero** — ya aplicadas al proyecto vinculado durante este ciclo (2026-09-26): `20260927000000_fix_products_categories_role_scope.sql` (excluye RESTAURANT del catálogo ajeno) y `20260927000100_catalog_policies_role_allowlist.sql` (endurecimiento a allowlist anon/CUSTOMER/ADMIN, ver 1.4). El `db push --dry-run` posterior responde "Remote database is up to date". Verificar en producción/staging que el catálogo público sigue funcionando antes de desplegar el código de la app.
2. **El fix de queries de la Fase 1** (páginas de restaurante) junto con el resto del release de app: la migración ya cerró el hueco; las queries explícitas son la capa de defensa y no bloquean si se atrasan.
3. **Fase 2 (refactor de Admin)** en el mismo release que 3 y 4, o antes — es invisible para el usuario, bajo riesgo, buen candidato para mergear primero.
4. **Fases 3 y 4 (+5)** en el mismo release final: dependen de la Fase 2 y son la entrega visible del pulido.

### 6.2 — Checklist de regresión completo (ejecutar antes de dar por cerrado el ciclo)

- [ ] Restaurante A no ve productos/categorías de Restaurante B (Fase 1). *— requiere sesión con dos restaurantes de prueba.*
- [ ] Cliente anónimo y cliente autenticado siguen viendo el catálogo público completo (la allowlist de la Fase 1 no debe romper `/restaurantes`, `/cliente`, `/(public)/restaurantes/[slug]`, ni la API pública `app/api/v1/products|categories` sin token). *— requiere sesión.*
- [ ] Un usuario DELIVERY ya NO ve el catálogo vía sesión propia (endurecimiento de 1.4); sus flujos de panel siguen intactos (usan snapshots de `order_items`). *— requiere sesión.*
- [ ] Admin sigue viendo y editando todos los restaurantes/productos sin restricción (`products_all_admin`/`categories_all_admin` intactas, tocadas por este plan). *— requiere sesión.*
- [ ] `/admin` — dashboard idéntico visualmente al estado previo al refactor de la Fase 2. *— requiere sesión; el código extraído se revisó pieza por pieza.*
- [ ] `/restaurante` — filtros Día/Semana/Mes + rango funcionan, gráficos con degradado lime/violeta, solo datos propios. *— requiere sesión para la parte de datos.*
- [ ] `/repartidor` — nuevos gráficos presentes, mismos filtros, solo datos del repartidor autenticado, cards existentes sin regresión. *— requiere sesión para la parte de datos.*
- [x] `pnpm run typecheck` sin errores en todo el repo. *(2026-09-26: `tsc --noEmit` limpio.)*
- [x] `pnpm run lint` sin errores nuevos en los archivos tocados. *(2026-09-26: 0 errores y 0 warnings en todos los archivos del ciclo; los 7 warnings del proyecto son preexistentes en carousel/LogoLoop, fuera del alcance.)*
- [x] `pnpm run build` de producción exitoso. *(2026-09-26: `next build` compila; las rutas de los tres paneles siguen dinámicas `ƒ`.)*
- [ ] Verificación manual en mobile (breakpoints `sm`/`lg`) de que la barra de filtros compartida (`DashboardRangeFilterBar`) no rompe el layout en pantallas angostas en ninguno de los tres paneles. *— requiere dispositivo/viewport real; el markup es el mismo que Admin venía usando con `flex-wrap`.*

### 6.3 — Resultado de la ejecución de las Fases 5 y 6 (2026-09-26)

**Fase 5 — auditoría de consistencia visual (los 5 puntos del plan):**
1. **Spacing/contenedor:** `app/repartidor/page.tsx` pasa de `size="lg"` (`max-w-4xl`) a **`size="full"`**, igual que `/admin` y `/restaurante`, con comentario del porqué. Los tres paneles comparten ahora el mismo ancho de dashboard.
2. **Iconografía de estados vacíos:** los cuatro gráficos nuevos usan exactamente el estándar de Admin: `h-8 w-8 text-muted-foreground/40` + `max-w-52` + `flex-col items-center justify-center gap-2` con mensaje dinámico. Mapeo ícono↔semántica heredado de Admin: `BarChart3Icon` (dinero/ventas), `TruckIcon` (entregas), `PackageOpenIcon` (productos).
3. **Card header:** los cuatro `<CardTitle>` nuevos llevan el patrón "punto de color + texto" de Admin (`flex items-center gap-2 text-base` + `span h-2 w-2 rounded-full`), con el color que corresponde a cada métrica: lime en Ventas/Ingresos, violeta en Productos más vendidos/Entregas.
4. **Accesibilidad:** `accessibilityLayer` presente en los 6 `<BarChart>` del proyecto (2 Admin + 2 Restaurante + 2 Repartidor).
5. **Reduced motion:** verificado — `app/globals.css` ya neutraliza animaciones/transiciones globalmente bajo `prefers-reduced-motion: reduce` (regla universal `*, *::before, *::after`), y los gráficos nuevos no introducen ninguna animación CSS propia fuera de las transiciones SVG nativas de Recharts.

**Fase 6:** verificado lo automatizable (typecheck/lint/build, ítems marcados arriba); los 8 ítems que exigen sesión con datos reales (dos restaurantes, dos repartidores, cliente anon/autenticado, admin, mobile) quedan como QA manual pendiente, con la garantía estática correspondiente anotada en cada uno. Este plan se ejecutó **sin commits**: todo el trabajo vive sin commitear en la rama `develop/fjp`.

---

## Resumen de archivos

### Archivos nuevos (los únicos de todo el plan, cada uno justificado arriba)
- `supabase/migrations/20260927000000_fix_products_categories_role_scope.sql` — Fase 1, corrección de seguridad, obligatorio. **Aplicada al proyecto vinculado.**
- `supabase/migrations/20260927000100_catalog_policies_role_allowlist.sql` — endurecimiento posterior de la Fase 1 (allowlist anon/CUSTOMER/ADMIN, ver nota al final de 1.4). **Aplicada al proyecto vinculado.**
- `lib/dashboard/chart-utils.ts` — Fase 2, evita triplicar lógica de fechas/agregación.
- `components/features/dashboard/DashboardRangeFilterBar.tsx` — Fase 2, evita triplicar la barra de filtros.
- `components/features/deliveries/DeliveryDashboardCharts.tsx` — Fase 4, completa un patrón que el propio proyecto ya usa dos veces (Cards vs. Charts separados) y que hoy no existe para Repartidor.

### Archivos existentes modificados
- `app/restaurante/productos/page.tsx` — Fase 1 (`.eq('restaurant_id', …)` en count/products/categories).
- `app/restaurante/categorias/page.tsx` — Fase 1 (filtro explícito).
- `app/restaurante/productos/nuevo/page.tsx` — Fase 1 (filtro del Select de categorías).
- `components/features/admin/AdminDashboardCharts.tsx` — Fase 2 (consume las primitivas extraídas; 402 → 265 líneas).
- `app/restaurante/page.tsx` — Fase 3 (async, una query con el rango máximo + filtro explícito).
- `components/features/restaurants/RestaurantDashboardCharts.tsx` — Fase 3 (server → client, filtros compartidos).
- `components/features/restaurants/DailySalesChart.tsx` — Fases 3 y 5 (restyle lime + punto de color).
- `components/features/restaurants/TopProductsChart.tsx` — Fases 3 y 5 (restyle violeta + punto de color).
- `app/repartidor/page.tsx` — Fases 4 y 5 (async, query con rango máximo, `size="full"`).
- `app/api/v1/products/route.ts` y `app/api/v1/categories/route.ts` — endurecimiento de la Fase 1: solo comentarios (el branch final es CUSTOMER, no "CUSTOMER / DELIVERY").
- `docs/plans/plan-pulido-paneles-restaurante-delivery.md` — este plan: estado por fase, resultados de ejecución y decisiones.

Ningún otro archivo del repo necesita tocarse para cumplir lo pedido.
