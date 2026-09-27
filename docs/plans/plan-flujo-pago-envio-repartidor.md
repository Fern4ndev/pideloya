# Plan de Implementación — Oferta de Envío + Pago por Yape (Cliente ↔ Repartidor)

**Proyecto:** PideloYa
**Autor del plan:** Revisión técnica estilo senior (+20 años), sobre el código real del repo.
**Alcance:** Nuevo paso en el ciclo de vida del pedido: el repartidor ve la dirección de entrega de un pedido `PENDING`, propone una tarifa de envío (por defecto S/ 5), el cliente ve la foto de perfil y el QR de Yape del repartidor, confirma que pagó, y recién ahí el pedido pasa a "repartidor en camino al negocio".

> **Nota sobre las skills solicitadas (`ui-ux-pro-max`, `vercel-react-best-practices`, `supabase-postgres-best-practices`):** la ruta `C:\Users\ferna\.agents\skills` vive en tu máquina local; mi entorno de ejecución es un sandbox aislado sin acceso a tu filesystem, así que no pude leer esos `SKILL.md` directamente — mismo caso ya documentado en tus planes anteriores (`plan-pulido-paneles-restaurante-delivery.md`, `plan-perfil-repartidor-foto-yape-password.md`). Este plan aplica los mismos principios que esas skills normalmente encapsulan: Server Components por defecto, mutaciones vía Server Actions, RLS como fuente de verdad + defensa en profundidad, funciones `SECURITY DEFINER` de superficie mínima en vez de políticas RLS permisivas por fila completa, snapshots en vez de joins fragiles, jerarquía visual clara, estados vacíos/carga consistentes, accesibilidad (contraste, foco, `prefers-reduced-motion`) — y los cito en cada fase para que los verifiques contra tus skills si difieren.

---

## Índice de fases

| Fase | Nombre | Tipo | Prioridad |
|---|---|---|---|
| 0 | Diagnóstico del estado actual | Lectura | — |
| 1 | Modelo de datos: enum, columnas, RLS y funciones `SECURITY DEFINER` | Migración SQL | Alta |
| 2 | Server Actions y reglas de negocio | Backend | Alta |
| 3 | UI del Repartidor — ofertar y esperar confirmación | Frontend | Alta |
| 4 | UI del Cliente — ver repartidor, QR y confirmar pago | Frontend | Alta |
| 5 | Detalles de UX: privacidad de dirección, zoom de QR, tarifa sugerida | UX | Media |
| 6 | Casos borde y ciclo de vida (cancelación, timeout, eliminación de cuentas) | Backend | Alta |
| 7 | Corrección relacionada: "Ingresos generados" del repartidor usaba el precio de la comida, no su tarifa de envío | Bug fix | Media-Alta |
| 8 | QA — suite E2E + checklist manual | QA | Obligatoria |
| 9 | Orden de despliegue | DevOps | Obligatoria |

**Estado (2026-09-27): plan implementado de punta a punta — fases 0 a 9.** Las cinco migraciones están aplicadas al proyecto vinculado y verificadas por REST. La Fase 8 quedó mayormente cubierta por dos suites E2E con sesiones reales (50 + 30 verificaciones, todo en verde, cero warnings) más la lectura con `service_role`; lo que queda sin marcar necesita pantalla o sesión de admin en navegador. El hallazgo del bypass del admin (Fase 8) quedó cerrado. La Fase 9 quedó con el estado real de despliegue y lo único que falta. Ver "Notas de implementación" al final de cada fase.

Orden recomendado: **1 → 2 → 3 → 4 → 6 → 7 → 5 → 8 → 9**. Las fases 1-2 son invisibles para el usuario y de alto riesgo si se saltan (todo lo demás depende de ellas). La fase 7 se beneficia de tener ya `delivery_fee` disponible, así que va después de 1-2 pero puede ir en paralelo a 3-4.

---

## Fase 0 — Diagnóstico del estado actual

Verificado contra el código real del repo:

1. **Estados de pedido hoy:** `PENDING → ASSIGNED → PICKED_UP → ON_THE_WAY → DELIVERED` (o `CANCELLED`). `ASSIGNED` ya significa **"Repartidor en camino al negocio"** (`lib/constants/order-status.ts`) — es decir, hoy un repartidor pasa de "buscando" a "en camino" en un solo paso (`acceptOrder` / `POST /api/v1/deliveries/[orderId]/accept`), sin tarifa de envío ni confirmación de pago de por medio. El nuevo flujo inserta un estado entre ambos.
2. **`profiles.avatar_url` y `profiles.yape_qr_url` ya existen** (migración `20260928000000_profiles_delivery_media.sql`) y ya las sube el repartidor desde `/repartidor/perfil`. No hace falta tocar esa parte — solo **exponerlas al cliente**, cosa que hoy no ocurre: ninguna policy RLS permite a un cliente leer la fila `profiles` de su repartidor asignado. Esto ya estaba anotado como pendiente en `docs/decisions-and-learnings.md` ("Consideraciones futuras... Mostrar el avatar del repartidor al cliente... requeriría una nueva policy RLS acotada").
3. **`orders.total` es el subtotal de comida**, calculado en servidor (`createOrder`, `POST /api/v1/orders`) sumando `unit_price * quantity`. No incluye ni incluirá el envío — el envío es dinero que va directo al repartidor por Yape, no a la plataforma ni al restaurante. Por eso el envío vive en una columna aparte (`delivery_fee`), nunca mezclado con `total` (mismo principio de snapshots ya usado en `order_items.product_name`, `orders.customer_name`, etc.: cada dato vive en su propia columna con su propio significado).
4. **Una sola entrega activa por repartidor** ya es una regla de negocio existente (`acceptOrder`, `app/api/v1/deliveries/[orderId]/accept/route.ts`, `lib/admin/delivery-lifecycle.ts::getActiveDelivery`). El nuevo estado `AWAITING_PAYMENT` debe contar como "activo" para esta regla — si no, un repartidor podría enviar ofertas a diez pedidos a la vez mientras espera que le paguen.
5. **RLS y funciones `SECURITY DEFINER` ya son el patrón establecido** del proyecto para evitar recursión entre tablas (`current_role()`, `current_profile_id()`, `current_delivery_order_ids()`, etc., todas en `20260823172245_rls_policies.sql` y `20260828044635_fix_orders_deliveries_rls_recursion.sql`). Este plan sigue exactamente ese patrón para las piezas nuevas, en vez de inventar un enfoque distinto.
6. **`deliveries.accepted_at`** hoy se setea en el momento en que el repartidor toma el pedido (`acceptOrder`). Con el nuevo flujo, ese instante deja de ser "el repartidor aceptó" y pasa a ser **"el repartidor propuso una tarifa"** — el verdadero "aceptado" ahora es cuando el *cliente* confirma el pago. Se resuelve con una columna nueva (`offered_at`) para el momento de la oferta, dejando `accepted_at` con un significado ligeramente reinterpretado pero coherente: "cuándo arrancó de verdad la entrega" — los dashboards que ya ordenan/filtran por `accepted_at` (`DeliveryHistoryTable`, `DeliveryDashboardCards`) siguen funcionando sin cambios, porque ese momento sigue siendo el inicio real del trabajo del repartidor.
7. **Duplicación de tipos encontrada:** `OrderStatus` está definido dos veces — `lib/constants/order-status.ts` (deriva de `ORDER_STATUS_STEPS`) y `types/order.ts` (unión literal manual). Ambos deben actualizarse; se documenta aquí para que no se olvide ninguno de los dos.
8. **Hallazgo que este plan corrige de paso (Fase 7):** `DeliveryDashboardCharts.tsx` grafica "Ingresos generados" usando `orders.total` (el precio de la comida) — dinero que **nunca** fue del repartidor. Con `delivery_fee` disponible, este gráfico pasa a mostrar la ganancia real del repartidor.

---

## Fase 1 — Modelo de datos

**Principio (`supabase-postgres-best-practices`):** cambios aditivos, sin bloqueos, sin backfill destructivo; RLS ampliada solo donde es indispensable, y para las transiciones multi-tabla (dos updates que deben ser atómicos y donde RLS por fila no basta para restringir columnas) se usan funciones `SECURITY DEFINER` de superficie mínima — el mismo criterio que ya usa el proyecto para `current_role()` y compañía, aplicado ahora a una operación de negocio completa en vez de solo a un cálculo auxiliar.

### 1.1 — Nuevo valor del enum `order_status`

`supabase/migrations/<timestamp>_order_status_awaiting_payment.sql`

```sql
-- ============================================================================
-- PideloYa — Nuevo estado: AWAITING_PAYMENT
-- ============================================================================
-- Se inserta entre PENDING y ASSIGNED: el repartidor ya propuso una tarifa
-- de envío, pero el cliente todavía no confirma haber pagado por Yape.
-- ASSIGNED sigue significando exactamente lo mismo que hoy ("repartidor en
-- camino al negocio") — solo que ahora se llega ahí después de este paso,
-- no directo desde PENDING.
--
-- IMPORTANTE: ALTER TYPE ... ADD VALUE no puede usarse en la misma
-- transacción en la que luego se referencia el valor nuevo (limitación de
-- Postgres). Por eso va en su propia migración, separada de la que crea las
-- policies/funciones que lo usan (Fase 1.3).
-- ============================================================================

alter type public.order_status add value if not exists 'AWAITING_PAYMENT' after 'PENDING';
```

### 1.2 — Columnas nuevas

`supabase/migrations/<timestamp>_delivery_offer_columns.sql`

```sql
-- ============================================================================
-- PideloYa — Columnas para la oferta de envío y su confirmación de pago
-- ============================================================================
alter table public.deliveries
  add column if not exists delivery_fee numeric(10,2),
  add column if not exists offered_at timestamptz,
  add column if not exists payment_confirmed_at timestamptz;

alter table public.orders
  add column if not exists delivery_fee numeric(10,2);

comment on column public.deliveries.delivery_fee is
  'Tarifa de envío (S/) que el repartidor propuso al ofertar el pedido. Editable por él mientras payment_confirmed_at sea NULL.';
comment on column public.deliveries.offered_at is
  'Cuándo el repartidor propuso la tarifa. Antes de este cambio, accepted_at marcaba este momento; ahora accepted_at pasa a marcar cuándo el CLIENTE confirmó el pago y el envío arranca de verdad — los dashboards que ya ordenan/filtran por accepted_at (DeliveryHistoryTable, DeliveryDashboardCards) no necesitan cambios porque ese instante sigue siendo "el trabajo real empezó".';
comment on column public.deliveries.payment_confirmed_at is
  'Cuándo el cliente confirmó (de buena fe) haber pagado por Yape. No hay pasarela de pago integrada: es una confirmación manual del cliente, no una verificación bancaria.';
comment on column public.orders.delivery_fee is
  'Snapshot de deliveries.delivery_fee una vez el cliente confirma el pago (lo escribe confirm_delivery_payment(), ver Fase 1.3). NULL mientras el pedido está PENDING o AWAITING_PAYMENT sin confirmar. Nunca se suma a orders.total: son dos ingresos de dueños distintos (restaurante vs. repartidor).';

-- Backfill: ninguno. NULL es el estado correcto para "todavía sin oferta" en
-- pedidos existentes y futuros anteriores a este cambio.
```

### 1.3 — RLS ampliada + funciones `SECURITY DEFINER`

`supabase/migrations/<timestamp>_delivery_offer_rls_and_functions.sql`

```sql
-- ============================================================================
-- PideloYa — RLS y funciones para el flujo de oferta de envío
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) El repartidor necesita ver la dirección de un pedido PENDING para poder
--    cotizar el envío ANTES de comprometerse — hoy solo ve la dirección de
--    pedidos que ya tiene asignados (addresses_select_assigned_delivery).
--
--    Se apoya en una función SECURITY DEFINER, mismo patrón que
--    current_delivery_address_ids() (20260828044635), para no acoplar la
--    policy de `addresses` a una subconsulta directa contra `orders`.
-- ----------------------------------------------------------------------------
create or replace function public.pending_order_address_ids()
returns setof uuid
language sql
security definer
set search_path = public
stable
as $$
  select address_id from public.orders where status = 'PENDING'
$$;

create policy "addresses_select_pending_delivery"
on public.addresses for select
using (
  public.current_role() = 'DELIVERY'
  and id in (select public.pending_order_address_ids())
);

-- ----------------------------------------------------------------------------
-- 2) El repartidor pasa el pedido de PENDING a AWAITING_PAYMENT al enviar su
--    oferta (antes pasaba directo a ASSIGNED al aceptar). Se amplía el
--    mismo check ya existente — current_delivery_order_ids() ya cubre
--    "pedidos con una fila mía en deliveries", que existe desde el
--    instante en que se inserta la oferta.
-- ----------------------------------------------------------------------------
drop policy if exists "orders_update_delivery_assigned" on public.orders;
create policy "orders_update_delivery_assigned"
on public.orders for update
using (
  public.current_role() = 'DELIVERY'
  and id in (select public.current_delivery_order_ids())
)
with check (
  status in ('AWAITING_PAYMENT', 'ASSIGNED', 'PICKED_UP', 'ON_THE_WAY', 'DELIVERED')
);

-- ----------------------------------------------------------------------------
-- 3) El cliente puede cancelar mientras el pago AÚN no se confirmó (PENDING
--    o AWAITING_PAYMENT) — nada de dinero cambió de manos todavía dentro de
--    la plataforma. Una vez ASSIGNED (pago autoconfirmado), deja de ser
--    autoservicio, mismo criterio que ya regía para PENDING únicamente.
-- ----------------------------------------------------------------------------
drop policy if exists "orders_update_own_customer_cancel" on public.orders;
create policy "orders_update_own_customer_cancel"
on public.orders for update
using (
  customer_id = public.current_profile_id()
  and status in ('PENDING', 'AWAITING_PAYMENT')
)
with check (
  status = 'CANCELLED'
);

-- ----------------------------------------------------------------------------
-- 4) confirm_delivery_payment: transición atómica AWAITING_PAYMENT -> ASSIGNED
--
-- Por qué una función y no dos UPDATEs desde el cliente protegidos por RLS:
-- la operación toca DOS tablas (orders + deliveries) y debe ser atómica; y
-- una policy de UPDATE directa sobre `deliveries` para el cliente sería a
-- nivel de FILA, no de columna — un cliente con esa policy podría, con un
-- PATCH manual, tocar delivery_person_id o delivered_at, no solo
-- payment_confirmed_at. (El proyecto ya tiene un hallazgo abierto sobre que
-- los REVOKE a nivel de columna podrían no ser efectivos — ver
-- docs/decisions-and-learnings.md, sección final.) Una función angosta que
-- SOLO hace esta transición es la superficie de ataque mínima posible.
-- ----------------------------------------------------------------------------
-- OJO: el cuerpo de abajo es la PROPUESTA del plan. La versión implementada
-- difiere en el orden de las validaciones, en las guardas de identidad y en
-- los errcode — ver "Notas de implementación (Fase 1)" al final de esta fase.
create or replace function public.confirm_delivery_payment(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer_id uuid;
  v_status public.order_status;
  v_delivery_id uuid;
  v_fee numeric(10,2);
begin
  select o.customer_id, o.status, d.id, d.delivery_fee
    into v_customer_id, v_status, v_delivery_id, v_fee
  from public.orders o
  left join public.deliveries d on d.order_id = o.id
  where o.id = p_order_id
  for update of o;

  if v_customer_id is null then
    raise exception 'Pedido no encontrado';
  end if;

  if v_customer_id <> public.current_profile_id() then
    raise exception 'No puedes confirmar el pago de un pedido que no es tuyo';
  end if;

  if v_status <> 'AWAITING_PAYMENT' then
    raise exception 'Este pedido no tiene una oferta de envío esperando confirmación';
  end if;

  if v_delivery_id is null then
    raise exception 'No hay repartidor asociado a este pedido';
  end if;

  -- El .is(payment_confirmed_at, null) implícito en el WHERE es la guarda
  -- de idempotencia: si ya se confirmó, no vuelve a marcar y "not found"
  -- dispara el mensaje de abajo — mismo patrón que ya usa cancelOrder()
  -- (update encadenado a un .eq('status', 'PENDING') para detectar 0 filas).
  update public.deliveries
  set payment_confirmed_at = now(),
      accepted_at = now()
  where id = v_delivery_id
    and payment_confirmed_at is null;

  if not found then
    raise exception 'El pago de este pedido ya fue confirmado';
  end if;

  update public.orders
  set status = 'ASSIGNED',
      delivery_fee = v_fee
  where id = p_order_id
    and status = 'AWAITING_PAYMENT';
end;
$$;

revoke all on function public.confirm_delivery_payment(uuid) from public;
grant execute on function public.confirm_delivery_payment(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- 5) get_delivery_offer_profile: expone SOLO nombre, foto y QR del
--    repartidor asignado a un pedido PROPIO del cliente que llama — nunca
--    teléfono, documento ni ningún otro campo de `profiles`. Evita dar al
--    cliente una policy de SELECT de fila completa sobre `profiles` (que
--    hoy solo permite leer la propia fila o al admin leer todas).
-- ----------------------------------------------------------------------------
create or replace function public.get_delivery_offer_profile(p_order_id uuid)
returns table (full_name text, avatar_url text, yape_qr_url text, delivery_fee numeric)
language sql
security definer
set search_path = public
stable
as $$
  select p.full_name, p.avatar_url, p.yape_qr_url, d.delivery_fee
  from public.orders o
  join public.deliveries d on d.order_id = o.id
  join public.profiles p on p.id = d.delivery_person_id
  where o.id = p_order_id
    and o.customer_id = public.current_profile_id()
$$;

revoke all on function public.get_delivery_offer_profile(uuid) from public;
grant execute on function public.get_delivery_offer_profile(uuid) to authenticated;
```

### 1.4 — `types/database.ts`

Agregar a mano (mismo criterio que las fases anteriores del proyecto — editar en el mismo commit que la migración):

- `orders.delivery_fee: number | null` en `Row`/`Insert`/`Update`.
- `deliveries.delivery_fee: number | null`, `offered_at: string | null`, `payment_confirmed_at: string | null`.
- `Enums.order_status` agrega `'AWAITING_PAYMENT'`.
- `Functions` agrega `confirm_delivery_payment` y `get_delivery_offer_profile` con sus firmas (`Args`/`Returns`), siguiendo el estilo ya usado para `current_role`, `current_profile_id`, etc.

### Criterios de aceptación de la Fase 1
- Un repartidor autenticado puede leer `addresses` de cualquier pedido `PENDING`, y de ningún otro pedido ajeno.
- Un cliente **no** puede leer la fila `profiles` de un repartidor por ningún medio directo (solo vía `get_delivery_offer_profile`, y solo para pedidos propios).
- Llamar `confirm_delivery_payment` dos veces seguidas la segunda vez lanza "El pago de este pedido ya fue confirmado" y no reescribe nada.
- Llamar `confirm_delivery_payment` con el `order_id` de otro cliente lanza "No puedes confirmar el pago de un pedido que no es tuyo".

### Notas de implementación (Fase 1) — desviaciones deliberadas respecto al plan

Archivos creados (los tres ya aplicados al proyecto remoto `jtggpdqucheuovvcjqff`, en este orden):

1. `supabase/migrations/20260928100000_order_status_awaiting_payment.sql` — enum, solo.
2. `supabase/migrations/20260928100100_delivery_offer_columns.sql` — columnas + constraints.
3. `supabase/migrations/20260928100200_delivery_offer_rls_and_functions.sql` — RLS + funciones.

Decisiones donde el código final difiere (a propósito) del SQL de ejemplo de arriba:

- **Orden de validaciones en `confirm_delivery_payment`.** El plan evaluaba el estado antes de la idempotencia, pero eso hacía imposible su propio criterio de aceptación: la segunda llamada encontraba el pedido ya en `ASSIGNED` y devolvía "no tiene una oferta esperando confirmación" en vez de "ya fue confirmado". Ahora la idempotencia (`payment_confirmed_at is not null`) se evalúa primero, con su mensaje propio, y el chequeo de estado después.
- **Guardas de identidad con `is distinct from` (no `<>`) + rechazo explícito si no hay perfil.** Con `<>`, un llamador sin `auth.uid()` (por ejemplo `service_role` vía `adminClient()`) obtenía `NULL` en la comparación y el `if` no se disparaba: la confirmación pasaba de largo. Ahora falla con `42501` / 'No autenticado' — verificado contra la base real.
- **`if not found` también tras el UPDATE de `orders`.** Si el estado cambió entre el SELECT y el UPDATE (cancelación en paralelo), se levanta excepción: como el RPC es su propia transacción, se revierte también el update de `deliveries`, así "pago confirmado" y "pedido arrancado" nunca quedan a medias.
- **Ningún mensaje de error compite:** cada rechazo tiene su `errcode` (`42501` identidad, `P0002` no encontrado, `23505` ya confirmado, `22000` estado inválido, `40001` conflicto) para que la Fase 2 pueda distinguirlos si algún día lo necesita.
- **CHECK de dinero añadido (no estaba en el plan):** `deliveries_delivery_fee_check` y `orders_delivery_fee_check` con `delivery_fee is null or delivery_fee > 0`. Zod valida el rango de producto (S/ 1–S/ 30) en el servidor; la base garantiza la invariante de datos (una tarifa nunca negativa) sin importar qué camino escriba la fila.
- **`revoke ... from public, anon` (no solo `public`).** En Supabase, `anon` recibe EXECUTE por privilegios por defecto sobre funciones nuevas del schema `public`, así que revocar solo de `public` dejaba la puerta abierta. Verificado: `anon` → `42501 permission denied`.
- **`pending_order_address_ids()` NO se revoca (a diferencia de las otras dos).** Las expresiones de una policy RLS se evalúan con los privilegios del rol que consulta: si un rol pierde EXECUTE sobre una función usada en un `USING`, la consulta falla con "permission denied for function" en vez de devolver cero filas. Es el mismo motivo por el que `current_role()` y compañía tampoco se revocan. Lo único que expone es el UUID de direcciones de pedidos `PENDING` — identificador no enumerable que no da acceso a la fila (`addresses` sigue protegida por RLS) y que cualquier repartidor ya ve por diseño.
- **El plan subestimó una dependencia de tipos:** agregar el valor al enum hace que `Database["public"]["Enums"]["order_status"]` (que es el tipo de `orders.status` en todas las queries) deje de ser asignable al `OrderStatus` de la aplicación, que estaba duplicado y desactualizado. Para que `tsc` volviera a pasar hubo que propagar el estado también a `lib/constants/order-status.ts` (label, step, grupo `active`) y a `types/order.ts`, y dar entrada propia a `AWAITING_PAYMENT` en los dos mapas `NEXT_STATUS` (Server Action y ruta API). Sin eso, la Fase 1 rompía el build.
- **`advanceOrderStatus` ahora corta cuando `next === currentStatus`** (igual que ya hacía la ruta API). Antes, un `DELIVERED` o `CANCELLED` ejecutaba un UPDATE sin efecto y revalidaba rutas de más; con `AWAITING_PAYMENT` en el mapa, ese silencio habría sido peor: sugiere avance sin pago confirmado.
- **Pendiente y consciente:** `OrderStatusBadge` todavía no tiene rama propia para `AWAITING_PAYMENT` (hoy cae en el badge neutro con el label correcto). Es parte de la Fase 3, junto con el banner de cliente de la Fase 4.
- **Verificación ejecutada:** `tsc --noEmit`, `eslint` sobre los 5 archivos tocados y `next build` en verde; `supabase db push` aplicado; y sobre la base real: columnas nuevas presentes, `status=eq.AWAITING_PAYMENT` aceptado como filtro, `get_delivery_offer_profile` devolviendo `[]` para un pedido ajeno/nulo, `confirm_delivery_payment` devolviendo `42501 No autenticado` sin sesión, `anon` bloqueado en ambas RPC, y el CHECK rechazando `delivery_fee = -5` con `23514`. Lo que **no** se pudo probar sin sesión real (repartidor/cliente): las policies nuevas de `addresses` y de cancelación, y la transición completa `PENDING → AWAITING_PAYMENT → ASSIGNED` — queda en el checklist manual de la Fase 8.

---

## Fase 2 — Server Actions y reglas de negocio

### 2.1 — Validación

`lib/validations/delivery-offer.ts` (nuevo)

```ts
import { z } from 'zod'

// S/ 5 es la tarifa por defecto que ve el repartidor al abrir el formulario
// (se define en el componente, no aquí) — el rango aceptado por el server
// es más amplio, para no atarse a un número "mágico" en la validación.
export const deliveryOfferSchema = z.object({
  deliveryFee: z.coerce
    .number()
    .min(1, 'La tarifa mínima es S/ 1')
    .max(30, 'La tarifa máxima es S/ 30'),
})

export type DeliveryOfferInput = z.infer<typeof deliveryOfferSchema>
```

### 2.2 — `lib/admin/delivery-lifecycle.ts`

```ts
// ACTIVE_DELIVERY_STATUSES gana AWAITING_PAYMENT: un repartidor esperando
// que le paguen está tan "ocupado" como uno en camino — si no, podría
// ofertar en diez pedidos a la vez mientras espera confirmaciones.
export const ACTIVE_DELIVERY_STATUSES = [
  'AWAITING_PAYMENT',
  'ASSIGNED',
  'PICKED_UP',
  'ON_THE_WAY',
] as const
```

`getActiveDelivery` y `releaseActiveDeliveries` no necesitan más cambios: ya consultan por estos estados vía `orders!inner(status)`, así que heredan el comportamiento correcto — incluida la guarda de `deactivateUser()` (un repartidor con una oferta pendiente de pago tampoco se puede desactivar) y la liberación defensiva de `deleteUser()` (una oferta sin confirmar se borra y el pedido vuelve a `PENDING`, igual que hoy con una entrega `ASSIGNED`).

### 2.3 — `lib/actions/deliveries.ts`

```ts
import { deliveryOfferSchema, type DeliveryOfferInput } from '@/lib/validations/delivery-offer'
import { ACTIVE_DELIVERY_STATUSES } from '@/lib/admin/delivery-lifecycle'

/**
 * Envía la oferta de envío para un pedido PENDING: el repartidor propone
 * una tarifa (S/ 1 a S/ 30) y el pedido pasa a AWAITING_PAYMENT. El cliente
 * verá su foto, su QR de Yape y esta tarifa para confirmar el pago.
 *
 * La regla de "una entrega activa a la vez" ahora también cuenta las
 * ofertas sin confirmar (ver ACTIVE_DELIVERY_STATUSES) — un repartidor no
 * puede tener dos ofertas/entregas abiertas simultáneamente.
 */
export async function sendDeliveryOffer(orderId: string, input: DeliveryOfferInput) {
  const data = deliveryOfferSchema.parse(input)
  const supabase = await createClient()
  const profileId = await getMyProfileId(supabase)

  const { data: active } = await supabase
    .from('orders')
    .select('id')
    .in('status', [...ACTIVE_DELIVERY_STATUSES])
    .limit(1)
  if (active && active.length > 0) {
    throw new Error(
      'Ya tienes una oferta o entrega activa. Complétala antes de ofertar en otra.'
    )
  }

  const { data: order } = await supabase
    .from('orders')
    .select('status')
    .eq('id', orderId)
    .single()
  if (!order || order.status !== 'PENDING') {
    throw new Error('Este pedido ya no está disponible')
  }

  const { error: insertError } = await supabase.from('deliveries').insert({
    order_id: orderId,
    delivery_person_id: profileId,
    delivery_fee: data.deliveryFee,
    offered_at: new Date().toISOString(),
  })
  // La restricción UNIQUE(order_id) es la red de seguridad real ante una
  // condición de carrera (dos repartidores ofertando el mismo pedido a la
  // vez) — mismo patrón que acceptOrder().
  if (insertError) {
    throw new Error('Alguien más ya está ofertando en este pedido')
  }

  const { error: orderError } = await supabase
    .from('orders')
    .update({ status: 'AWAITING_PAYMENT' })
    .eq('id', orderId)
  if (orderError) throw new Error(orderError.message)

  revalidatePath('/repartidor/disponibles')
  revalidatePath('/repartidor/pedidos')
  revalidatePath('/cliente/pedidos')
  revalidatePath(`/cliente/pedidos/${orderId}`)
  return { success: true }
}

/**
 * Retira una oferta que el cliente todavía no pagó: borra la fila de
 * `deliveries` y devuelve el pedido a PENDING, para que otro repartidor
 * pueda ofertar. Usa el cliente con service role (como
 * releaseActiveDeliveries): el repartidor no tiene, ni debe tener, permiso
 * RLS de DELETE sobre `deliveries` — es una acción poco frecuente y de
 * impacto suficiente para justificar la verificación manual en vez de una
 * policy nueva.
 */
export async function retractDeliveryOffer(orderId: string) {
  const supabase = await createClient()
  const profileId = await getMyProfileId(supabase)
  const adminClient = createServiceRoleClient()

  const { data: delivery } = await adminClient
    .from('deliveries')
    .select('id, payment_confirmed_at, orders!inner(status)')
    .eq('order_id', orderId)
    .eq('delivery_person_id', profileId)
    .maybeSingle()

  if (!delivery || delivery.payment_confirmed_at) {
    throw new Error('Esta oferta ya no se puede retirar')
  }

  const { error: deleteError } = await adminClient
    .from('deliveries')
    .delete()
    .eq('id', delivery.id)
  if (deleteError) throw new Error(deleteError.message)

  const { error: orderError } = await adminClient
    .from('orders')
    .update({ status: 'PENDING' })
    .eq('id', orderId)
    .eq('status', 'AWAITING_PAYMENT')
  if (orderError) throw new Error(orderError.message)

  revalidatePath('/repartidor/disponibles')
  revalidatePath('/repartidor/pedidos')
  revalidatePath('/cliente/pedidos')
  revalidatePath(`/cliente/pedidos/${orderId}`)
  return { success: true }
}
```

### 2.4 — `lib/actions/orders.ts`

```ts
/**
 * El cliente confirma que pagó la tarifa de envío por Yape. Llama a la
 * función SECURITY DEFINER confirm_delivery_payment (Fase 1.3), que hace la
 * transición AWAITING_PAYMENT -> ASSIGNED de forma atómica en dos tablas.
 * No hay pasarela de pago integrada: esto es una confirmación de buena fe
 * del cliente, no una verificación bancaria — se lo advierte en la UI
 * (Fase 4), no aquí.
 */
export async function confirmDeliveryPayment(orderId: string) {
  const supabase = await createClient()
  const { error } = await supabase.rpc('confirm_delivery_payment', {
    p_order_id: orderId,
  })
  if (error) throw new Error(error.message)

  revalidatePath('/cliente/pedidos')
  revalidatePath(`/cliente/pedidos/${orderId}`)
  revalidatePath('/repartidor/pedidos')
  return { success: true }
}
```

### 2.5 — `lib/constants/order-status.ts`

```ts
export const ORDER_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Buscando repartidor',
  AWAITING_PAYMENT: 'Confirma el pago del envío',
  ASSIGNED: 'Repartidor en camino al negocio',
  PICKED_UP: 'Pedido recogido',
  ON_THE_WAY: 'En camino a tu dirección',
  DELIVERED: 'Entregado',
  CANCELLED: 'Cancelado',
}

export const ORDER_STATUS_STEPS = [
  'PENDING',
  'AWAITING_PAYMENT',
  'ASSIGNED',
  'PICKED_UP',
  'ON_THE_WAY',
  'DELIVERED',
] as const

export const ORDER_STATUS_GROUPS = {
  active: ['PENDING', 'AWAITING_PAYMENT', 'ASSIGNED', 'PICKED_UP', 'ON_THE_WAY'],
  delivered: ['DELIVERED'],
  cancelled: ['CANCELLED'],
} as const
```

`types/order.ts::OrderStatus` (la definición manual duplicada, Fase 0.7) también debe agregar `'AWAITING_PAYMENT'`, y `ApiOrder`/`ApiOrderItem` deben incorporar `delivery_fee: number | null` en `ApiOrder`.

### 2.6 — Paridad con `app/api/v1/*` (para consumidores externos de la API)

Los mismos cambios de estado y campos deben reflejarse en:
- `app/api/v1/deliveries/route.ts` / `[orderId]/accept` / `[orderId]/advance`: agregar rutas equivalentes `POST /api/v1/deliveries/[orderId]/offer` (body `{ delivery_fee }`) y `POST /api/v1/deliveries/[orderId]/retract`, replicando la lógica de 2.3 con `adminClient()` + verificaciones explícitas (mismo patrón que ya usan `accept`/`advance`).
- `app/api/v1/orders/[id]/route.ts`: agregar `action: 'confirm_payment'` al `PUT`, delegando a la misma función `confirm_delivery_payment` vía `client.rpc(...)` con `adminClient()` (el `rpc` de un cliente `service_role` se ejecuta igual, pero `current_profile_id()` dentro de la función usa `auth.uid()` — con service role no hay `auth.uid()`, así que esta ruta debe pasar el `profileId` explícito o, más simple, seguir usando el cliente autenticado por Bearer (`createBearerClient`) en vez de `adminClient()` para este caso puntual, ya que la función depende de `auth.uid()`).

> Nota de diseño: `confirm_delivery_payment` depende de `auth.uid()` dentro de la función `SECURITY DEFINER` — funciona perfecto desde Server Actions (cliente con cookies) y desde la API con `createBearerClient(accessToken)`, pero **no** desde `adminClient()` (no hay usuario autenticado). Documentarlo así evita que alguien intente "simplificar" la ruta API usando `adminClient()` y rompa la validación de dueño del pedido.

### Criterios de aceptación de la Fase 2
- Un repartidor con una oferta `AWAITING_PAYMENT` no puede enviar otra oferta ni aceptar otro pedido hasta retirarla o que se confirme el pago.
- `retractDeliveryOffer` falla con un mensaje claro si el cliente ya confirmó el pago (no se puede "deshacer" un pago ya confirmado).
- `pnpm run typecheck` sin errores tras actualizar los dos `OrderStatus` (constants + types).

### Notas de implementación (Fase 2) — desviaciones deliberadas

**La desviación principal: ofertar y retirar son funciones SQL, no Server Actions con service role.**

El plan las resolvía en TypeScript (2.3): `sendDeliveryOffer` con el cliente autenticado (INSERT + UPDATE encadenados) y `retractDeliveryOffer` con `createServiceRoleClient()`. Ambas son transiciones que tocan DOS tablas y que deben ser atómicas, y las dos dejaban una ventana de estado inconsistente:

- Oferta a medias → fila en `deliveries` con el pedido todavía `PENDING`: el repartidor NO la ve en "Mis entregas" (esa lista filtra por estado del pedido), el pedido sigue apareciendo en "Disponibles" para otros y el `UNIQUE(order_id)` les impide tomarlo. Callejón sin salida para las dos partes.
- Retirada a medias → pedido en `AWAITING_PAYMENT` sin repartidor: el cliente ve "confirma el pago" para siempre, sin QR al que pagarle.

Además, la regla "un repartidor, una oferta o entrega activa" no se puede garantizar con un SELECT previo en la capa de aplicación: dos peticiones simultáneas del mismo repartidor (doble clic, dos pestañas) pasan las dos por el chequeo. Y el plan ya había aceptado este mismo criterio para `confirm_delivery_payment` ("la operación toca DOS tablas y debe ser atómica").

Por eso la migración `20260928100300_delivery_offer_functions.sql` agrega `offer_delivery(uuid, numeric)` y `retract_delivery_offer(uuid)`, ambas `SECURITY DEFINER`, con la autorización adentro. Efectos secundarios, todos buenos:

1. No hay cliente privilegiado en ningún paso nuevo del flujo (la retirada ya no usa service role).
2. `offer_delivery` bloquea la fila de `profiles` del repartidor: la regla de "una sola activa" pasa a ser atómica de verdad, no best-effort.
3. Las Server Actions **y** las rutas de `app/api/v1/**` comparten una única implementación — el plan advertía que la ruta API "replicaría la lógica de 2.3", que es justo donde las reglas se desincronizan.
4. `retract_delivery_offer` toma los locks en el orden `orders` → `deliveries`, el mismo que `confirm_delivery_payment`, para no exponerse a un deadlock AB-BA cuando el cliente confirma en el mismo instante en que el repartidor se retira.

**Resto de cambios de la fase, y por qué:**

- `ACTIVE_DELIVERY_STATUSES` (2.2) ahora es la ÚNICA fuente de la regla "una entrega activa": `acceptOrder` (Server Action) y `POST /api/v1/deliveries/[orderId]/accept` tenían la lista `['ASSIGNED','PICKED_UP','ON_THE_WAY']` copiada a mano en cada uno. Con AWAITING_PAYMENT agregado en un solo lugar, los tres caminos (ofertar, aceptar, desactivar/eliminar cuenta desde admin) quedan consistentes por construcción.
- `cancelOrder` (2.4 + ítem 10 del checklist de QA): además de cancelar, borra la oferta sin confirmar. La cancelación ya ocurrió y es lo que el cliente pidió, así que la limpieza es best-effort (si falla, deja una fila inerte que nadie lee) y usa service role porque el cliente no tiene —ni debe tener— policy de DELETE sobre `deliveries`. La guarda `payment_confirmed_at is null` es dura: una entrega con dinero ya confirmado no se borra nunca.
- **Bug de autorización corregido de paso en la API**: `PUT /api/v1/orders/[id]` con `action: 'cancel'` usaba `adminClient()` (salta RLS) y solo verificaba el ROL, nunca el dueño del pedido — un cliente autenticado podía cancelar cualquier pedido PENDING ajeno conociendo su id. Ahora filtra `customer_id = context.profileId` cuando quien llama es CUSTOMER. Se corrige acá porque al ampliar la cancelación a AWAITING_PAYMENT el agujero se agrandaba.
- `lib/api/auth.ts::userClient(request)` (nuevo): cliente con el mismo Bearer token, necesario para las RPC que resuelven identidad con `auth.uid()`. El plan (2.6) advertía que `adminClient()` rompe estas funciones; con este helper las rutas quedan a una línea de la función en vez de reimplementar sus validaciones.
- `lib/api/response.ts::rpcErrorResponse()` (nuevo): traduce el `errcode` de las funciones SQL a status HTTP (42501→403, P0002→404, 23505/40001→409, resto 400). Es la razón por la que cada `raise exception` lleva errcode explícito: la API distingue causa sin parsear mensajes.
- `confirm_payment` en la API delega en `userClient(request).rpc(...)`, exactamente como pedía la nota de diseño del 2.6.
- `GET /api/v1/orders` (rol DELIVERY) incluye `AWAITING_PAYMENT` en el filtro de estados: sin eso, la oferta del repartidor no aparecía en "Mis entregas" y el botón de retirarla era inalcanzable. `ApiOrder` incorpora `delivery_fee` (snapshot del pedido) y `deliveries.delivery_fee` (la tarifa ofertada, que necesita el diálogo de retirada).
- **Pendiente consciente (Fase 4):** el backend ya permite cancelar en AWAITING_PAYMENT, pero `OrderStatusSection` todavía muestra el botón "Cancelar pedido" solo en PENDING. La UI del cliente se reescribe en la Fase 4; no tiene sentido parchearla ahora.
- **Verificación ejecutada:** `tsc --noEmit`, `eslint` de todo lo tocado y `next build` en verde (incluidas las dos rutas nuevas); migración aplicada; y contra la base real: `anon` recibe `42501 permission denied` en las dos funciones nuevas, y `service_role` (sin `auth.uid()`) recibe `42501 No autenticado` en ambas — la guarda de identidad funciona. Los caminos felices (ofertar, confirmar, retirar) requieren una sesión real de repartidor/cliente: quedan para la Fase 8.

---

## Fase 3 — UI del Repartidor

**Archivos a modificar:** `components/features/deliveries/AvailableOrdersClient.tsx`, `components/features/deliveries/DeliveryOrderCard.tsx`, `components/features/deliveries/DeliveryOrdersClient.tsx`, `components/features/deliveries/AdvanceStatusButton.tsx` (o un componente hermano nuevo para el caso `AWAITING_PAYMENT`).

### 3.1 — Formulario de oferta (reemplaza el botón "Aceptar" plano)

Nuevo componente `components/features/deliveries/SendOfferForm.tsx`:

```tsx
'use client'

import { useState, useTransition } from 'react'
import { sendDeliveryOffer } from '@/lib/actions/deliveries'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/toast'

const DEFAULT_FEE = '5'

export function SendOfferForm({ orderId }: { orderId: string }) {
  const [fee, setFee] = useState(DEFAULT_FEE)
  const [isPending, startTransition] = useTransition()
  const { error, success } = useToast()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      try {
        await sendDeliveryOffer(orderId, { deliveryFee: Number(fee) })
        success('Oferta enviada', 'Avisaremos cuando el cliente confirme el pago.')
      } catch (err) {
        error('No se pudo enviar la oferta', err instanceof Error ? err.message : undefined)
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2">
      <div className="relative w-24">
        <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
          S/
        </span>
        <Input
          type="number"
          inputMode="decimal"
          step="0.5"
          min="1"
          max="30"
          value={fee}
          onChange={(e) => setFee(e.target.value)}
          className="pl-7"
          aria-label="Tarifa de envío"
        />
      </div>
      <Button type="submit" size="sm" variant="lime" disabled={isPending}>
        {isPending ? 'Enviando…' : 'Enviar oferta'}
      </Button>
    </form>
  )
}
```

- El valor por defecto `"5"` cumple literalmente "por defecto es 5" y queda completamente editable.
- `type="number"` con `min`/`max`/`step` da validación nativa además de la de Zod en el servidor (defensa en profundidad, mismo criterio del resto del proyecto).

### 3.2 — Mostrar la dirección de entrega en "Disponibles"

`AvailableOrdersClient.tsx` ya trae `order.addresses?.address_text` del endpoint `GET /api/v1/orders` (rol `DELIVERY`) — hoy simplemente no lo pasa a `DeliveryOrderCard`. Cambio mínimo:

```tsx
<DeliveryOrderCard
  key={order.id}
  restaurantName={item0?.restaurant_name ?? restaurant?.name ?? 'Restaurante'}
  pickupAddress={restaurant?.address_text}
  itemsSummary={itemsSummary}
  deliveryAddress={order.addresses?.address_text}   {/* ← nuevo */}
  total={Number(order.total)}
  action={<SendOfferForm orderId={order.id} />}      {/* ← reemplaza AcceptOrderButton */}
/>
```

`DeliveryOrderCard` ya sabe renderizar `deliveryAddress` (lo usa en "Mis entregas"); no necesita cambios propios.

> **Nota de privacidad (decisión de producto, no técnica):** esto expone la dirección exacta del cliente a *cualquier* repartidor que abra "Disponibles", incluso antes de comprometerse — es lo que pediste explícitamente ("el repartidor viendo la dirección... pondrá un precio"). Apps como Uber/Rappi suelen mostrar solo la zona aproximada o la distancia hasta que el repartidor se compromete, por privacidad del cliente. Si más adelante quieres ese comportamiento más conservador, el cambio es acotado: en vez de `address_text`, mostrar una distancia calculada (Fase 5.3) y revelar el texto completo recién en `AWAITING_PAYMENT`. Lo dejo señalado aquí para que la decisión quede documentada, pero implementado como lo pediste.

### 3.3 — Filtrar `AWAITING_PAYMENT` fuera de "Disponibles"

`AvailableOrdersClient.tsx`: el filtro `orders.filter((o) => o.status === 'PENDING')` ya excluye automáticamente los pedidos en `AWAITING_PAYMENT` — sin cambios necesarios ahí.

### 3.4 — "Mis entregas" durante `AWAITING_PAYMENT`

`DeliveryOrdersClient.tsx`: ampliar el filtro de "activas" para incluir el nuevo estado, y renderizar una acción distinta mientras se espera el pago:

```tsx
const orders = (data?.data ?? []).filter((o) =>
  ['AWAITING_PAYMENT', 'ASSIGNED', 'PICKED_UP', 'ON_THE_WAY'].includes(o.status)
)
```

```tsx
action={
  order.status === 'AWAITING_PAYMENT' ? (
    <RetractOfferButton orderId={order.id} feeText={`S/ ${order.delivery_fee}`} />
  ) : (
    <AdvanceStatusButton orderId={order.id} currentStatus={order.status} />
  )
}
```

`RetractOfferButton` (nuevo, pequeño, mismo patrón que `AcceptOrderButton`): botón `variant="ghost"` que llama a `retractDeliveryOffer` con un `confirm()` o `ConfirmDialog` ("¿Retirar esta oferta? El pedido volverá a estar disponible para otros repartidores.").

`OrderStatusBadge.tsx` necesita una rama para `AWAITING_PAYMENT` (sugerido: `variant="outline"` con un tono ámbar, coherente con el resto de banners de "esperando" del proyecto).

### Criterios de aceptación de la Fase 3
- Un repartidor ve la dirección de entrega y puede enviar una oferta con la tarifa que quiera (dentro de S/1–S/30) directamente desde "Disponibles".
- Mientras espera confirmación, "Mis entregas" muestra el pedido con un badge distinto y la opción de retirar la oferta — no aparece el botón "Marcar como recogido" hasta que el cliente pague.
- Intentar ofertar en un segundo pedido mientras hay una oferta activa muestra el toast de error correspondiente.

### Notas de implementación (Fase 3)

- **El formulario de oferta va en un pie a lo ancho de la tarjeta, no junto al total.** `DeliveryOrderCard` ganó un slot `footer` (`mt-3 border-t pt-3`) y `AvailableOrdersClient` lo usa en vez de `action`. Motivo: el `action` original sólo alojaba un botón; el formulario necesita un input, y en un teléfono de 360px meterlo a la derecha del nombre del restaurante comprimía la columna de texto hasta hacerla inusable. Con el pie, el repartidor ve el pedido completo arriba y decide la tarifa abajo.
- **Label visible en vez de sólo `aria-label`.** El input de tarifa lleva `<label>` "Tarifa de envío" (con `useId()`, porque hay un formulario por tarjeta en la lista) y el `S/` va como prefijo `aria-hidden`. Un placeholder no es un label: cuando el usuario empieza a escribir, deja de existir para quien necesita el contexto.
- **Alturas alineadas:** el botón de envío usa el tamaño default (`h-8`) para coincidir con el input de al lado; el botón de retirada usa `size="sm"` como el resto de acciones de la tarjeta.
- **Zod en el servidor + `min`/`max`/`step` nativos** en el input: misma defensa en profundidad que el resto del proyecto (el navegador da feedback inmediato, la Server Action es la que decide).
- **Tras enviar la oferta se navega a `/repartidor/pedidos`** (mismo comportamiento que el antiguo botón Aceptar), en vez de confiar en que la lista se refresque sola: la tarjeta sale de "Disponibles" por un `revalidatePath`, pero la lista se pide por SWR y lo que garantiza el cambio de vista es la navegación. El repartidor queda donde está lo que ahora le importa: su oferta, con el badge de espera y la opción de retirarla.
- **En AWAITING_PAYMENT no se renderiza `AdvanceStatusButton`**: no hay nada que avanzar hasta que el cliente pague (el botón devolvía `null` de todos modos, pero ahora la intención es explícita). En su lugar el pie muestra el monto que está cobrando (`Tu envío: S/ 5.00 · esperando que el cliente confirme el pago.`) y el `RetractOfferButton`.
- **`RetractOfferButton`** usa el `ConfirmDialog` del proyecto (no un `confirm()` del navegador): es una acción que deja al cliente sin repartidor, así que pide confirmación explícita y muestra el monto en el cuerpo del diálogo, que es el dato con el que el repartidor decide.
- **`OrderStatusBadge` gana la rama ámbar** (`outline` + `border-amber-300/70 bg-amber-50 text-amber-800`, con su par en dark). Ámbar es el lenguaje de "esperando algo de alguien" que el proyecto ya usa en el banner de pedido buscando repartidor y en el de negocio cerrado; se distingue de PENDING (neutro) porque acá hay una acción pendiente del usuario, no una espera pasiva.
- **`AcceptOrderButton.tsx` eliminado.** El plan lo reemplazaba por el formulario, así que dejarlo era dejar un componente inalcanzable que alguien "arreglaría" más adelante. La Server Action `acceptOrder` y `POST /api/v1/deliveries/[orderId]/accept` SÍ se conservan (contrato público de la API v1), y ya heredan la regla de "una sola activa" desde `ACTIVE_DELIVERY_STATUSES`.
- **Copia actualizada:** el estado vacío de "Mis entregas" decía "Ve a Disponibles para aceptar un pedido" y ahora dice "para ofertar por un pedido".
- **Accesibilidad/motion:** sin animaciones nuevas (nada que sumar a `prefers-reduced-motion`), foco y estados de carga con el patrón ya existente (`disabled` + texto "Enviando…"/"Procesando…"). El target táctil queda en la escala del sistema de diseño (los botones más grandes del proyecto son h-9); subir *todos* los controles a 44px es una decisión de sistema, no de este formulario, y queda anotada como posible mejora transversal.

---

## Fase 4 — UI del Cliente

**Archivos a modificar:** `app/cliente/pedidos/[id]/page.tsx`, `components/features/orders/OrderStatusTimeline.tsx`, `components/features/orders/OrderStatusSection.tsx`, `components/features/orders/OrdersListClient.tsx`.

### 4.1 — Tarjeta de pago (nuevo componente)

`components/features/orders/DeliveryPaymentCard.tsx` (client component):

```tsx
'use client'

import { useState, useTransition } from 'react'
import Image from 'next/image'
import { confirmDeliveryPayment } from '@/lib/actions/orders'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog'
import { useToast } from '@/components/ui/toast'
import { ExpandIcon } from 'lucide-react'

export function DeliveryPaymentCard({
  orderId,
  deliveryPerson,
}: {
  orderId: string
  deliveryPerson: { fullName: string; avatarUrl: string | null; yapeQrUrl: string | null; deliveryFee: number }
}) {
  const [isPending, startTransition] = useTransition()
  const { error, success } = useToast()
  const initial = deliveryPerson.fullName.trim().charAt(0).toUpperCase() || '?'

  function handleConfirm() {
    startTransition(async () => {
      try {
        await confirmDeliveryPayment(orderId)
        success('¡Listo! Tu repartidor ya puede ir por tu pedido.')
      } catch (err) {
        error('No se pudo confirmar', err instanceof Error ? err.message : undefined)
      }
    })
  }

  return (
    <div className="rounded-3xl border border-amber-300/60 bg-amber-50/60 p-5 dark:border-amber-500/30 dark:bg-amber-500/10">
      <div className="flex items-center gap-3">
        <Avatar size="lg" className="h-14 w-14 ring-2 ring-white">
          {deliveryPerson.avatarUrl && <AvatarImage src={deliveryPerson.avatarUrl} alt="" />}
          <AvatarFallback className="bg-gradient-to-br from-brand-400 to-brand-600 text-lg font-semibold text-white">
            {initial}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="text-sm font-medium">{deliveryPerson.fullName} aceptará tu pedido</p>
          <p className="text-xs text-muted-foreground">
            Costo de envío: <span className="font-semibold text-foreground">S/ {deliveryPerson.deliveryFee.toFixed(2)}</span>
          </p>
        </div>
      </div>

      {deliveryPerson.yapeQrUrl && (
        <Dialog>
          <DialogTrigger
            render={
              <button
                type="button"
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-black/5 bg-white p-2 dark:border-white/10 dark:bg-white/5"
              />
            }
          >
            <div className="relative h-40 w-40">
              <Image src={deliveryPerson.yapeQrUrl} alt="QR de Yape del repartidor" fill className="object-contain" />
            </div>
            <span className="sr-only">Ver QR en grande</span>
            <ExpandIcon className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
          </DialogTrigger>
          <DialogContent className="flex flex-col items-center gap-4 sm:max-w-xs">
            <div className="relative h-72 w-72">
              <Image src={deliveryPerson.yapeQrUrl} alt="QR de Yape del repartidor" fill className="object-contain" />
            </div>
          </DialogContent>
        </Dialog>
      )}

      <p className="mt-3 text-xs text-muted-foreground">
        Escanea el QR y paga S/ {deliveryPerson.deliveryFee.toFixed(2)} por Yape. Cuando lo hayas
        hecho, confirma abajo — no verificamos el pago automáticamente, así que solo confirma
        cuando ya hayas transferido.
      </p>

      <Button className="mt-4 w-full rounded-full" onClick={handleConfirm} disabled={isPending}>
        {isPending ? 'Confirmando…' : 'Ya pagué, confirmar'}
      </Button>
    </div>
  )
}
```

Puntos de diseño (`ui-ux-pro-max`):
- El aviso de "no verificamos el pago automáticamente" es honestidad radical: evita que el cliente asuma que hay una pasarela real detrás.
- El QR es tocable para verlo en grande (`Dialog` ya usado en el resto del proyecto) — un QR de 40×40px es difícil de escanear directo desde la pantalla del celular del cliente sosteniendo el celular del repartidor al lado; en grande se escanea mejor.
- Colores ámbar (mismo lenguaje de "esperando" que `RestaurantOpenBanner`/`OrderStatusSection` ya usan) en vez de un color nuevo.

### 4.2 — Integrarla en el detalle del pedido

`app/cliente/pedidos/[id]/page.tsx` (Server Component): traer el perfil del repartidor vía la función RPC cuando el estado es `AWAITING_PAYMENT`:

```tsx
const { data: order } = await supabase.from('orders').select(/* ...igual que hoy... */).eq('id', id).maybeSingle()

let deliveryOffer: { full_name: string; avatar_url: string | null; yape_qr_url: string | null; delivery_fee: number } | null = null
if (order?.status === 'AWAITING_PAYMENT') {
  const { data } = await supabase.rpc('get_delivery_offer_profile', { p_order_id: id }).maybeSingle()
  deliveryOffer = data
}
```

```tsx
{order.status === 'AWAITING_PAYMENT' && deliveryOffer && (
  <div className="mt-6">
    <DeliveryPaymentCard
      orderId={order.id}
      deliveryPerson={{
        fullName: deliveryOffer.full_name,
        avatarUrl: deliveryOffer.avatar_url,
        yapeQrUrl: deliveryOffer.yape_qr_url,
        deliveryFee: Number(deliveryOffer.delivery_fee),
      }}
    />
  </div>
)}
```

### 4.3 — Timeline con el paso nuevo

`OrderStatusTimeline.tsx` no necesita lógica nueva: como ya itera `ORDER_STATUS_STEPS` (Fase 2.5 lo amplió), el paso "Confirma el pago del envío" aparece automáticamente con el mismo rail/halo que los demás. Sí conviene, en la página de detalle, **no duplicar** la explicación — el timeline muestra el nombre del paso; `DeliveryPaymentCard` (4.1) es donde vive la acción real.

### 4.4 — Lista de pedidos y banner

`components/features/orders/OrdersListClient.tsx`:
- `ORDER_STATUS_GROUPS.active` ya incluye `AWAITING_PAYMENT` (Fase 2.5) — el chip "Activos" ya los cuenta sin cambios.
- Agregar un banner específico, más urgente que el de "buscando repartidor" (este sí requiere una acción del cliente, no es solo espera pasiva):

```tsx
const awaitingPaymentCount = orders.filter((o) => o.status === 'AWAITING_PAYMENT').length

{awaitingPaymentCount > 0 && (
  <Link
    href={`/cliente/pedidos/${orders.find((o) => o.status === 'AWAITING_PAYMENT')!.id}`}
    className="mt-2 flex items-center gap-3 rounded-2xl border border-amber-300/60 bg-amber-50/80 px-4 py-3 backdrop-blur-sm"
  >
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-600">
      <QrCodeIcon className="h-4 w-4" />
    </span>
    <div>
      <p className="text-sm font-medium text-amber-800">
        Tu repartidor ya está listo — confirma el pago del envío
      </p>
      <p className="text-xs text-amber-600">Toca aquí para ver el QR y confirmar</p>
    </div>
  </Link>
)}
```

Si hubiera más de un pedido en `AWAITING_PAYMENT` a la vez (raro, pero un cliente podría tener varios pedidos activos), enlazar al primero y dejar que el resto se vea en la lista de abajo es suficiente para el alcance de este plan.

### 4.5 — Mostrar el envío en el total del pedido

`app/cliente/pedidos/[id]/page.tsx`, bloque de total: mientras `order.status` es `PENDING` o `AWAITING_PAYMENT` sin confirmar, `order.delivery_fee` es `NULL` — mostrar "Envío: se define al asignar un repartidor". Una vez `delivery_fee` tiene valor (a partir de `ASSIGNED`):

```tsx
<div className="space-y-1.5 rounded-3xl bg-brand-500/5 px-4 py-3.5 shadow-client-card">
  <div className="flex items-center justify-between text-sm text-muted-foreground">
    <span>Subtotal</span>
    <span>S/ {Number(order.total).toFixed(2)}</span>
  </div>
  <div className="flex items-center justify-between text-sm text-muted-foreground">
    <span>Envío</span>
    <span>
      {order.delivery_fee != null ? `S/ ${Number(order.delivery_fee).toFixed(2)}` : 'Por confirmar'}
    </span>
  </div>
  <div className="flex items-center justify-between border-t border-black/5 pt-1.5 dark:border-white/10">
    <span className="text-sm font-medium">Total</span>
    <span className="text-xl font-bold text-brand-700">
      S/ {(Number(order.total) + Number(order.delivery_fee ?? 0)).toFixed(2)}
    </span>
  </div>
</div>
```

> Nota: `order.total` **sigue siendo solo comida** — nunca se reescribe para incluir el envío. La suma solo ocurre en la UI, al momento de mostrarla. Esto mantiene intactos los dashboards de restaurante/admin que ya usan `orders.total`/`order_items` para reportar ventas del negocio (Fase 0.3).

### Criterios de aceptación de la Fase 4
- El cliente ve la foto, el nombre y el QR del repartidor únicamente cuando el pedido está en `AWAITING_PAYMENT` de un pedido propio — nunca antes, nunca de otro pedido.
- Al confirmar el pago, el timeline avanza a "Repartidor en camino al negocio" sin recargar (realtime existente sobre `orders` ya cubre esto).
- El total muestra "Por confirmar" antes de la oferta y el monto real después.

### Notas de implementación (Fase 4)

- **El avatar se reutiliza, no se duplica.** `DeliveryAvatar` (ya existente en `components/features/admin/`) hace exactamente lo que la tarjeta necesita — foto y, si falta o la URL está muerta, la inicial sobre el degradado de marca. Se le agregó un prop opcional `className` (retrocompatible) para poder escalarlo a 56px con anillo cuando es protagonista, y la tarjeta lo usa en vez de reescribir el mismo `Avatar` + `AvatarFallback`. Importar desde `admin/` no es una excepción nueva: `ConfirmDialog` ya se comparte así con categorías y productos.
- **Lectura de la RPC:** se usa `offers?.[0]` en lugar de `.maybeSingle()`. `get_delivery_offer_profile` es `returns table`, así que PostgREST devuelve un arreglo; tomar el primer elemento evita depender de la semántica de "objeto único" de PostgREST en un caso donde no existe fila.
- **Si la oferta no tuviera tarifa, no se muestra la tarjeta.** Un botón "ya pagué, confirmar" sobre un monto en cero sería peor que no ofrecerlo.
- **El total usa la tarifa de la oferta como respaldo.** `orders.delivery_fee` es un snapshot que se escribe recién al confirmar el pago, así que durante AWAITING_PAYMENT sigue en NULL. Mostrar "Por confirmar" en el total mientras la tarjeta de arriba dice "S/ 5.00" sería una contradicción visible en la misma pantalla: se resuelve con `orders.delivery_fee ?? oferta.delivery_fee`. El desglose (Subtotal / Envío / Total) lleva además una línea que aclara que **el envío se paga directo al repartidor por Yape** — sin eso, el cliente ve dos montos y un total que no entiende.
- **El QR usa `next/image`** (no `<img>`): `next.config.ts` ya declara `ik.imagekit.io` en `remotePatterns`, y con `fill` + `sizes` en los dos tamaños (160px / 288px) el navegador no descarga de más. La vista previa es un `<button>` real con la leyenda visible "Toca para ampliarlo": un QR táctil que nadie sabe que es táctil es un afordance muerto, y por eso la pista no va como `sr-only`.
- **Degradación con gracia** (ítem del checklist): si el repartidor no cargó QR, se muestra un recuadro punteado que invita a confirmar solo si ya acordaron cómo transferirle. No se expone su teléfono: la RPC no lo devuelve a propósito.
- **Copy ajustado:** "«Nombre» llevará tu pedido" en vez de "aceptará tu pedido" — cuando la tarjeta aparece, el repartidor ya aceptó; lo que falta es el pago.
- **`router.refresh()` al confirmar**, además del `revalidatePath` de la Server Action: el objetivo es que la tarjeta desaparezca de la vista en el mismo instante en que el timeline avanza, no solo que se invalide el árbol RSC.
- **Se cierra la costura que quedó abierta en la Fase 2:** `OrderStatusSection` ahora ofrece "Cancelar pedido" también en AWAITING_PAYMENT (el backend ya lo permitía desde la Fase 1). Se puede cancelar mientras el pago no esté confirmado; después, no.
- **Copy del banner de PENDING corregido:** decía "Te avisaremos cuando alguien lo acepte" y ahora dice "cuando un repartidor te ofrezca el envío" — en el flujo nuevo nadie "acepta" sin precio, y el aviso anterior describía el paso que ya no existe.
- **Dos banners, en orden de urgencia:** el de AWAITING_PAYMENT (requiere acción del cliente) va primero; el de PENDING (espera pasiva) después.

---

## Fase 5 — Detalles de UX

1. **Privacidad de la dirección (ver nota 3.2):** si el equipo decide no mostrar la dirección exacta a todos los repartidores navegando "Disponibles", la alternativa de menor esfuerzo es calcular la distancia en línea recta (fórmula de Haversine, sin dependencias nuevas) entre `restaurants.latitude/longitude` y `addresses.latitude/longitude`, y mostrar "≈ 2.3 km" en vez del texto de la dirección hasta que la oferta se confirme. Se documenta como alternativa, no como parte obligatoria de este plan.
2. **Tarifa sugerida por distancia (opcional, fase futura):** con la distancia ya calculada (punto anterior), se podría sugerir `Math.max(5, Math.ceil(distanciaKm) * 1.5)` como valor inicial del input en vez de un `5` fijo — mejora de producto, no de este ciclo.
3. **Nombre del repartidor:** mostrar el nombre completo (`full_name`) es consistente con lo que ya se le pide en el registro; si más adelante se quiere más privacidad, mostrar solo el primer nombre (`fullName.split(' ')[0]`) es un cambio de una línea en `DeliveryPaymentCard`.
4. **Accesibilidad:** el botón "Ya pagué, confirmar" debe tener suficiente contraste y un estado de carga claro (ya cubierto arriba); el QR en el `Dialog` necesita `alt="QR de Yape del repartidor"` (ya incluido) para lectores de pantalla, aunque un QR en sí no es "leíble" — el `alt` documenta qué es, no lo que dice.
5. **`prefers-reduced-motion`:** ninguna animación nueva de este plan (el `Dialog` ya respeta la regla global existente en `app/globals.css`).

### Notas de implementación (Fase 5)

- **Ítem 1 (privacidad de la dirección): el comportamiento NO cambió, y es deliberado.** El plan lo dejaba supeditado a una decisión de producto, y esa decisión ya estaba tomada en el sentido contrario: mostrar la dirección exacta a quien va a cotizar el envío fue un requisito explícito del pedido original. En vez de elegir entre "dirección" o "distancia", se implementó la distancia como dato ADICIONAL (`lib/geo/distance.ts`, Haversine sin dependencias): sirve al mismo objetivo — cotizar mejor — sin quitarle al repartidor la información que el negocio pidió mostrar. Si algún día se prefiere el modo conservador, la pieza ya está puesta: basta con no renderizar la dirección en "Disponibles" hasta que la oferta esté confirmada.
- **Ítem 2 (tarifa sugerida por distancia): IMPLEMENTADO** — era el otro punto de la fase con código detrás. `suggestedDeliveryFee()` = S/ 1.50 por kilómetro redondeando hacia arriba, con piso en S/ 5 y techo en el máximo que acepta el servidor. El techo no es decorativo: sin él, un envío de 21 km prellenaría el input con 31.5 y el navegador bloquearía el envío por su propio `max` — la peor forma de comunicar un error. El valor llega como valor inicial de un input editable, y la distancia se muestra junto al label porque es el dato con el que se decide. Los tres números del dominio (mínimo, máximo y default) viven ahora en `lib/validations/delivery-offer.ts` en vez de estar repartidos entre el esquema, el componente y la fórmula.
- **La distancia puede no existir.** `restaurants.latitude/longitude` son nullable en la base; `haversineDistanceKm` devuelve `null` (y no 0) en ese caso, y el formulario cae al default. Devolver 0 habría sugerido S/ 5 igual, pero por el motivo equivocado y con el mismo resultado por casualidad.
- **Se verificó la matemática, no la confianza:** la implementación se contrastó contra distancias conocidas — Plaza Mayor → Parque Kennedy = 8.52 km (esperado ≈8.4–8.5 en línea recta) y Lima → Arequipa = 766.3 km (≈767) — más los bordes: mismo punto = 0, coordenada faltante = `null`, y el formato (350 m / 2.3 km / 12.0 km).
- **Ítem 3 (nombre del repartidor): se mantiene el nombre completo**, como indica el plan. Mostrar solo el primer nombre sigue siendo un cambio de una línea en `DeliveryPaymentCard` si algún día se quiere más privacidad.
- **Ítem 4 (accesibilidad): verificado con números, y encontró un problema real.** Se midió el contraste de todos los pares que introduce este ciclo (conversión oklch → sRGB + ratio WCAG, sin dependencias): texto atenuado sobre la tarjeta de pago 4.65:1 en claro y 6.76:1 en oscuro (los montos, 19.42:1 y 16.73:1), botón "Ya pagué, confirmar" 17.18:1 en ambos esquemas, badge de AWAITING_PAYMENT 6.84:1 y 14.03:1. **El subtítulo del banner de la lista daba 3.11:1**, por debajo del 4.5:1 que exige el texto chico normal (`text-xs`), y su ícono sobre el chip daba 2.87:1, por debajo del 3:1 que pide un elemento no textual. Los dos se corrigieron a `amber-700` (4.89:1 sobre el banner, 4.52:1 sobre el hover y sobre el chip). El banner preexistente de "buscando repartidor" tenía exactamente el mismo par, así que se corrigió también: son dos banners que se ven juntos y dejarlos con tonos distintos tras arreglar uno habría sido peor que el arreglo.
- **Ítem 5 (`prefers-reduced-motion`): confirmado.** `app/globals.css` neutraliza animaciones y transiciones globalmente bajo esa preferencia (regla universal con `!important`), y este ciclo no agregó ninguna animación propia: el `Dialog` del QR y los estados de carga usan transiciones ya cubiertas por esa regla.

---

## Fase 6 — Casos borde y ciclo de vida

1. **Cliente elimina/anonimiza su cuenta con una oferta `AWAITING_PAYMENT` activa:** `orders.customer_id` ya es `SET NULL` (migración `20260923130100`) — el pedido queda huérfano de cliente pero la oferta del repartidor sigue viva. Igual que hoy no hay limpieza automática de pedidos activos al eliminar un cliente (fuera del alcance ya documentado en `plan-manejo-eliminacion-cuentas.md`), este plan no lo resuelve tampoco — se señala como riesgo conocido heredado, no nuevo.
2. **Repartidor eliminado/desactivado con una oferta sin confirmar:** ya cubierto por la Fase 2.2 (`ACTIVE_DELIVERY_STATUSES` incluye `AWAITING_PAYMENT`): `deactivateUser()` lo bloquea, `deleteUser()` libera la oferta y regresa el pedido a `PENDING` vía `releaseActiveDeliveries`.
3. **Timeout de la oferta (recomendado, no incluido en el MVP):** si el cliente nunca confirma el pago, el pedido queda en `AWAITING_PAYMENT` indefinidamente y el repartidor queda "ocupado" para siempre. Se recomienda una Edge Function programada (`pg_cron` + función SQL, o un cron externo llamando a un endpoint) que, cada N minutos, retire ofertas con `offered_at` de más de, por ejemplo, 10 minutos sin `payment_confirmed_at`, reutilizando la misma lógica de `retractDeliveryOffer` (borrar la fila, volver a `PENDING`). Se deja como **Fase futura explícita** por el esfuerzo de infraestructura (cron) que no estaba en el alcance pedido, pero es la pieza que le falta a este diseño para ser 100% robusto en producción.
4. **Dos repartidores ofertando el mismo pedido a la vez:** la restricción `UNIQUE(order_id)` en `deliveries` (ya existente) es la red de seguridad real; `sendDeliveryOffer` ya traduce el error de restricción a un mensaje legible.
5. **El repartidor cambia de opinión sobre la tarifa antes de que el cliente pague:** se puede permitir editar `deliveries.delivery_fee` mientras `payment_confirmed_at is null`, con una policy `deliveries_update_delivery_self` que ya existe (`using (delivery_person_id = current_profile_id())`) — no requiere cambios de RLS, solo una acción `updateDeliveryOffer(orderId, fee)` en `lib/actions/deliveries.ts` análoga a 2.3. Se sugiere como mejora menor, no obligatoria para el MVP (el repartidor siempre puede retirar y volver a ofertar).

### Notas de implementación (Fase 6)

**Estado de cada caso borde del plan:**

1. **Cliente eliminado/anonimizado con una oferta activa:** riesgo heredado, no nuevo — el flujo de baja de cuentas no limpia pedidos activos (ya documentado en `plan-manejo-eliminacion-cuentas.md`). Lo que cambia con esta fase: el repartidor **ya no queda trabado** aunque el cliente desaparezca, porque la oferta vence sola (punto 3) y él siempre puede retirarla a mano.
2. **Repartidor desactivado o eliminado con una oferta sin confirmar:** queda cubierto por construcción, sin código nuevo. Se verificó el camino real: `deactivateUser` consulta `getActiveDelivery` (que lee `ACTIVE_DELIVERY_STATUSES`, ya con AWAITING_PAYMENT) y **bloquea**; `deleteUser` llama a `releaseActiveDeliveries`, que borra la oferta y devuelve el pedido a PENDING. Único cambio: el mensaje del bloqueo ahora dice "una entrega **o una oferta de envío** en curso", porque antes describía mal el caso.
3. **Timeout de la oferta:** IMPLEMENTADO, no como "fase futura". `supabase/migrations/20260928100400_expire_stale_delivery_offers.sql` agrega `expire_stale_delivery_offers(p_max_age interval default '10 minutes')`, que retira las ofertas sin confirmar más viejas que la ventana indicada (borra la entrega y devuelve el pedido a PENDING, en una transacción) y **devuelve cuántas expiró**, para que el log del job sirva.
   - **Sin `pg_cron` a propósito** (decisión del equipo): la función queda lista y se invoca desde donde prefieran — un cron externo o una Edge Function con la service role key (`POST /rest/v1/rpc/expire_stale_delivery_offers`, cuerpo opcional), o a mano desde el dashboard para destrabar algo puntual.
   - **Privilegios:** solo `service_role`. Es una operación de sistema que no depende de `auth.uid()`; un cliente logueado no debe poder expirar ofertas ajenas a voluntad.
   - **Orden de locks consistente** (`orders` → `deliveries`, igual que `confirm_delivery_payment` y `retract_delivery_offer`): si el cliente confirma el pago en el mismo segundo en que el job expira la oferta, uno de los dos gana de forma consistente y el otro recibe un mensaje claro, en vez de quedar un pedido a medias. La segunda lectura de `deliveries` vuelve a exigir `payment_confirmed_at is null`, así que una entrega recién pagada nunca se borra.
4. **Dos repartidores ofertando el mismo pedido:** cubierto por el `UNIQUE(order_id)` de `deliveries` y, desde la Fase 2, por el bloqueo del pedido dentro de `offer_delivery`; el mensaje que ve el segundo es "Alguien más ya está ofertando en este pedido" (no un error de constraint crudo).
5. **Editar la tarifa antes del pago: NO implementado, por decisión.** El argumento a favor era su bajo costo (la RLS ya lo permitía). En contra pesa más: el cliente puede estar mirando —o escaneando— el QR con el monto que ya vio, y que ese monto cambie mientras paga rompe la única garantía razonable que da este flujo, que es que el precio mostrado sea el precio. Retirar y volver a ofertar cubre la necesidad sin esa ambigüedad. Queda documentado como decisión explícita, no como pendiente.

---

## Fase 7 — Corrección relacionada: ingresos reales del repartidor

**Hallazgo (Fase 0.8):** `components/features/deliveries/DeliveryDashboardCharts.tsx` grafica "Ingresos generados" sumando `Number(delivery.orders?.total ?? 0)` — el precio de la **comida**, que nunca fue del repartidor. Con `deliveries.delivery_fee` ya disponible tras la Fase 1, este es el momento correcto de corregirlo:

```tsx
// app/repartidor/page.tsx — agregar delivery_fee al select
const { data: deliveries } = await supabase
  .from('deliveries')
  .select('delivered_at, delivery_fee, orders(status, total)')
  // ...resto igual

// components/features/deliveries/DeliveryDashboardCharts.tsx
const completed = deliveries
  .filter((d) => d.delivered_at && d.orders?.status === 'DELIVERED')
  .map((d) => ({
    created_at: d.delivered_at as string,
    total: Number(d.delivery_fee ?? 0), // ← antes: d.orders?.total
  }))
```

Esto también implica que entregas **anteriores** a este cambio (con `delivery_fee` en `NULL`, porque el envío no existía como concepto) mostrarán S/ 0 en el histórico — es correcto y honesto (no se puede inventar una tarifa retroactiva), pero conviene comunicarlo en el checklist de QA para que no se lea como un bug.

### Criterios de aceptación
- El gráfico "Ingresos generados" del repartidor refleja la suma de `delivery_fee` de sus entregas completadas, no el precio de la comida.
- Entregas históricas sin `delivery_fee` se grafican como S/ 0, sin romper el gráfico.

### Notas de implementación (Fase 7)

- El cambio de fondo son tres líneas (el `select` de `app/repartidor/page.tsx`, el tipo `DashboardDelivery` y el `.map()` del gráfico), pero hay dos decisiones detrás:
  1. **Se dejó de traer `orders.total` en esa consulta.** No se cambió de fuente dejando el campo ahí: se eliminó del payload. Traer un dato que ya no se usa era parte del problema original —dos "totales" circulando por el mismo componente, uno con el significado equivocado— y la mejor forma de que el bug no vuelva es que el número equivocado no esté disponible.
  2. **El título pasó de "Ingresos generados" a "Ingresos por envío"** (y la serie del tooltip también). El nombre viejo era ambiguo exactamente en el sentido que causó el bug: no distinguía entre lo que factura el negocio y lo que gana el repartidor.
- **El artefacto histórico era la parte fácil de leer mal, y se resolvió en la UI.** Las entregas anteriores a este ciclo tienen `delivery_fee` en NULL y se grafican como S/ 0 —correcto y honesto: no se puede inventar retroactivamente una tarifa que nunca se cobró—, pero el estado vacío de ese gráfico decía "No hay entregas en el período seleccionado" aunque sí las hubiera. Ahora distingue los dos casos y explica que esas entregas son anteriores al cobro por envío: decirle a un repartidor con historial que ganó S/ 0 sin explicar por qué es lo que lo haría parecer dinero perdido.
- **`DeliveryDashboardCards` no necesitó cambios:** su tarjeta "Entregas activas" cuenta `deliveries` con `delivered_at is null`, que ya incluye las ofertas esperando el pago.

---

## Fase 8 — QA

La suite local `scripts/e2e-delivery-offer.mjs` (30 verificaciones, **TODO VERDE** el 2026-09-27) ejerce el flujo completo con sesiones reales: cliente, cliente2, repartidor, repartidor2 y admin por HTTP contra `next dev`, más `service_role` para leer las invariantes de base. Los ítems marcados abajo son los que esa suite o los chequeos sin sesión ya cubren; los que quedan sin marcar necesitan **ojos** (render, contraste, mapa) o una **sesión de admin en navegador** (las Server Actions de `/admin` no se pueden invocar por HTTP).

- [x] Migraciones aplicadas en orden: enum primero, columnas después, RLS/funciones al final (`supabase db push`). — *Evidencia:* las cinco aplicadas una por una; `db push --dry-run` sin nada pendiente.
- [ ] Un repartidor ve la dirección completa de un pedido `PENDING` en "Disponibles" y puede editar la tarifa antes de enviar la oferta. — *Parcial:* la RLS está cubierta por la suite ("el repartidor ve la dirección de un pedido `PENDING` ajeno"); el formulario de oferta no se abrió en un navegador.
- [x] Enviar una oferta pasa el pedido a `AWAITING_PAYMENT`; el repartidor ya no puede ofertar en otro pedido ni aceptar uno directo. — *Evidencia:* suite (oferta → `AWAITING_PAYMENT` + fila con `offered_at`; segunda oferta con una activa → `409`; `accept` sobre el pedido comprometido → `400` sin cambiar de dueño).
- [ ] El cliente, en `/cliente/pedidos/[id]`, ve la tarjeta con la foto, el nombre y el QR del repartidor, y el monto correcto. — *Parcial:* la RPC devuelve el nombre y la tarifa correctos (suite) y la tarjeta sólo se renderiza con una oferta válida; falta la revisión visual del QR ampliado en el `Dialog`.
- [ ] Un repartidor **sin** foto o **sin** QR cargado: la tarjeta del cliente degrada con gracia (inicial en vez de foto rota; sin bloque de QR si `yape_qr_url` es `null`). — *Parcial:* la suite corrió el caso entero con `avatar_url` y `yape_qr_url` en `NULL` (la RPC los devuelve vacíos); el render de la inicial y del recuadro sin QR no se vio en pantalla.
- [x] Confirmar el pago avanza el pedido a `ASSIGNED`, el repartidor ve "Marcar como recogido" en "Mis entregas", y `orders.delivery_fee` queda poblado. — *Evidencia:* suite (`ASSIGNED`, `orders.delivery_fee = 7.50`, `payment_confirmed_at`, y la cadena `PICKED_UP → ON_THE_WAY → DELIVERED` por la misma ruta que usa el botón).
- [x] Confirmar el pago dos veces seguidas (doble clic, o reintentar la Server Action) la segunda vez falla con un mensaje claro y no rompe nada. — *Evidencia:* suite (`409 El pago de este pedido ya fue confirmado`).
- [x] Retirar una oferta sin confirmar borra la fila de `deliveries`, el pedido vuelve a `PENDING`, y aparece de nuevo en "Disponibles" para otros repartidores. — *Evidencia:* suite (retract → `PENDING` sin fila; otro repartidor la puede tomar y volver a soltar, sin residuo).
- [x] Retirar una oferta **después** de que el cliente confirmó el pago falla con un mensaje claro (no se puede deshacer un pago confirmado). — *Evidencia:* suite (`409 El cliente ya confirmó el pago: esta oferta no se puede retirar`).
- [x] Cancelar el pedido como cliente funciona tanto en `PENDING` como en `AWAITING_PAYMENT`, y `cancelOrder()` limpia la fila de `deliveries`. — *Implementado en la Fase 2 y verificado por la suite:* cliente2 cancela en `AWAITING_PAYMENT` y el pedido queda `CANCELLED` sin oferta huérfana; además, la dirección de ese pedido deja de ser visible para el repartidor (la policy sólo alcanza `PENDING`).
- [ ] Desactivar/eliminar (desde `/admin`) a un repartidor con una oferta `AWAITING_PAYMENT` activa se bloquea (desactivar) o libera el pedido a `PENDING` (eliminar), igual que ya ocurre con `ASSIGNED`. — *Pendiente de sesión de admin en navegador:* son Server Actions, no rutas de la API. El camino de código se trazó en la Fase 6 (`getActiveDelivery` bloquea, `releaseActiveDeliveries` libera el pedido a `PENDING`) y el mensaje se corrigió para no decir "entrega en curso" cuando lo que hay es una oferta.
- [x] Un cliente **no** puede leer `profiles` de ningún repartidor por la API REST directa (`select * from profiles`), solo vía la función RPC y solo para sus propios pedidos. — *Evidencia:* suite (el `select` directo devuelve 0 filas; la RPC con el `order_id` de otro cliente, 0 filas; `anon`, `42501`).
- [ ] El gráfico "Ingresos por envío" del repartidor (Fase 7) muestra la tarifa de envío, no el precio de la comida, en entregas nuevas; y en el estado vacío de un repartidor con historial antiguo aparece el mensaje que explica el S/ 0. — *Parcial:* la fuente de datos está corregida y `orders.total` ya no se selecciona; falta ver el render (incluido el estado vacío nuevo) en pantalla.
- [ ] En "Disponibles", la distancia mostrada coincide con la real y la tarifa sugerida cambia con ella; con un restaurante sin ubicación cargada, la sugerencia cae a S/ 5. — *Parcial:* la fórmula está verificada contra distancias conocidas y el fallback devuelve `null` (no 0), que es lo que hace caer la sugerencia al default; falta la comparación contra un mapa.
- [x] `pnpm run typecheck` y `pnpm run lint` sin errores nuevos. — *Evidencia:* `tsc --noEmit` limpio, `eslint` sin errores en los archivos tocados y `next build` exitoso (incluidas las rutas nuevas de la API v1).

### Estado del checklist (2026-09-27)

Automático, ya en verde: `tsc --noEmit`, `eslint` de todo lo tocado y `next build` (incluidas las rutas nuevas de la API v1).

**Suite E2E con sesiones reales (2026-09-27).** `scripts/e2e-order-flow.mjs` (el suite que ya existía, 50 verificaciones) pasó completo después de este ciclo — no se rompió nada del flujo anterior, y la cadena de avance del admin se reescribió para entrar a `ASSIGNED` por el flujo real, con lo que el `WARN` histórico del estado huérfano desapareció — y `scripts/e2e-delivery-offer.mjs` (nuevo, 30 verificaciones) cubre el ciclo nuevo: oferta, guardas de tarifa y de una sola oferta activa, `accept` cerrado, `get_delivery_offer_profile` (dueño / otro cliente / anon), RLS de `profiles` y de direcciones, confirmación del pago con doble confirmación y confirmación ajena, retract antes y después del pago, la cadena completa hasta `DELIVERED`, cancelación en `AWAITING_PAYMENT` con limpieza de la oferta, el IDOR de cancelación, el job de expiración (una oferta fresca sobrevive, una de 20 minutos expira y libera el pedido) y los dos cierres del bypass del admin (Hallazgo 1).

La **carrera confirmar-vs-expirar** también quedó cubierta: con la oferta vencida se disparan `confirm_delivery_payment` y `expire_stale_delivery_offers` en paralelo y se verifica la invariante —nunca un pago confirmado sin entrega, ni una entrega borrada con el pago confirmado—. En la corrida real ganó el job (`confirm` respondió `400`, el pedido quedó `PENDING` y la fila se liberó), que es uno de los dos finales válidos.

Cómo se corre (los dos scripts viven en `/scripts`, que está en `.gitignore`: son herramientas locales, no parte del entregable):

```bash
./node_modules/.bin/next dev --port 3000 &
node --env-file=.env scripts/e2e-order-flow.mjs      # crea fixtures: cuentas, restaurantes, productos, direcciones
node --env-file=.env scripts/e2e-delivery-offer.mjs  # el ciclo nuevo
```

El script crea sus propios pedidos y los deja en estado terminal al final, así que se puede repetir. Deja limpio el `WARN` preexistente del suite viejo (ver Hallazgos).

Verificado contra la base real, sin sesión de usuario:

- Migraciones aplicadas en orden (enum → columnas → RLS/funciones → funciones de oferta → expiración); `db push --dry-run` no reporta nada pendiente.
- `anon` recibe `42501 permission denied` en `confirm_delivery_payment`, `get_delivery_offer_profile`, `offer_delivery`, `retract_delivery_offer` y `expire_stale_delivery_offers`.
- `service_role` (sin `auth.uid()`) recibe `42501 No autenticado` en las funciones que dependen de la identidad — la guarda funciona en vez de dejar pasar la operación.
- `get_delivery_offer_profile` con un `order_id` ajeno devuelve cero filas.
- El CHECK de dinero rechaza `delivery_fee = -5` con `23514`.
- `expire_stale_delivery_offers` responde `22000` con una ventana de `0 seconds` y `200` con el default y con `'10 minutes'` (hoy devuelve 0: no hay ofertas vencidas).

Ítems nuevos para el checklist manual (agregados por las fases 5 y 6):

- [ ] Con una oferta de más de 10 minutos sin pagar, invocar `expire_stale_delivery_offers` desde el dashboard/cron: el pedido vuelve a aparecer en "Disponibles" y desaparece de "Mis entregas" del repartidor.
- [ ] Confirmar el pago y expirar la oferta al mismo tiempo (dos pestañas): no queda un pedido en estado intermedio ni una entrega borrada con el pago confirmado.
- [ ] La distancia en "Disponibles" coincide con la real (comparar contra un mapa) y la sugerencia la sigue; sin ubicación de restaurante, la sugerencia cae a S/ 5.

Verificado sin sesión, además de lo de arriba (fases 5 y 7): la fórmula de distancia contra distancias conocidas (Plaza Mayor → Parque Kennedy 8.52 km; Lima → Arequipa 766.3 km) y los bordes (mismo punto = 0, coordenada faltante = `null`); y el contraste medido de todos los pares nuevos de color (tarjeta de pago, botón de confirmar, badge y banners), que es lo que destapó el 3.11:1 del subtítulo del banner.

Todo lo que depende de una sesión real por HTTP ya está en la suite. Lo que sigue marcado sin hacer es lo que necesita **pantalla** (QR ampliado, inicial del avatar, gráfico, mapa) o **sesión de admin en navegador** (desactivar/eliminar repartidor). El hallazgo 1 ya está decidido y aplicado (arriba), así que ya no hay decisiones de código abiertas.

### Hallazgos de la Fase 8

**1. El admin podía saltarse el pago entero — RESUELTO: se cerró.** El `NEXT_STATUS` de `PUT /api/v1/orders/[id]` —el mapa del comando `advance` para ADMIN/legacy, distinto de los dos mapas del repartidor— conservaba `PENDING → ASSIGNED`. Un admin podía, entonces, empujar un pedido de `PENDING` a `ASSIGNED` sin oferta, sin pago y **sin fila de `deliveries`** (el `WARN` que el suite viejo venía marcando). Con el flujo nuevo el estado era además más engañoso: el cliente veía "Repartidor en camino al negocio" sin repartidor y con `delivery_fee` en `NULL`.

De las dos salidas posibles —**cerrarlo** (el admin avanza sólo desde `ASSIGNED` en adelante) o **hacerlo coherente** (un override de soporte que además cree la fila de `deliveries`)— se aplicó la primera, por tres razones: no hay ni una sola pantalla de admin que invoque `advance` sobre `PENDING` (el comando sólo tenía consumidores de API, y ninguna herramienta de soporte real lo usa), el override coherente necesitaría elegir un repartidor para la fila de `deliveries` —que es exactamente lo que hace la oferta, o sea reinventar el flujo—, y la regla de negocio que este plan establece es que el único productor de `ASSIGNED` es la confirmación del pago. Así quedó:

- `PUT /api/v1/orders/[id]` con `action: 'advance'`: `PENDING` salió del mapa; sobre `PENDING`/`AWAITING_PAYMENT` responde `400` con el mensaje que explica el flujo ("necesita una oferta de envío y la confirmación de pago del cliente"). El admin conserva `ASSIGNED → … → DELIVERED` para soporte.
- `advanceOrderStatus` (Server Action): `PENDING` salió del mapa también (era código muerto: la UI nunca ofrece avanzar un `PENDING` y RLS exige tener el pedido asignado).
- **Segundo agujero del mismo tipo, encontrado y cerrado de paso:** `POST /api/v1/deliveries/[orderId]/accept` permitía que un ADMIN "aceptara" el pedido **como él mismo** — una entrega con el profile de un admin (no repartidor) como `delivery_person_id`, y el salto a `ASSIGNED` sin pago. Ahora la ruta es sólo `DELIVERY`; el admin no tiene ninguna acción de toma de pedidos, que es correcto: tomar pedidos es cosa de repartidores.

Ambos cierres tienen prueba en la suite nueva (`guard: el admin ya no puede saltarse el pago…` → 400; `guard: el admin ya no puede "aceptar"…` → 403) y la cadena de avance del admin en el suite viejo se reescribió para entrar a `ASSIGNED` por el flujo real (oferta + confirmación de pago): **50 PASS, 0 FAIL, 0 WARN** — el `WARN` histórico desapareció porque el estado huérfano ya no es producible.

**2. Lo que la suite no puede probar y por qué.** Los ítems con "pantalla" del checklist no son pereza de automatización: son render, contraste y geolocalización, y las dos herramientas disponibles (HTTP + `service_role`) ven el dato, no el píxel. El ítem de desactivar/eliminar repartidor es el único caso donde el límite es más incómodo —las Server Actions de `/admin` no tienen ruta HTTP equivalente— y por eso quedó con el camino de código documentado en la Fase 6 como respaldo.

---

## Fase 9 — Orden de despliegue

| # | Paso | Por qué en este orden |
|---|---|---|
| 1 | Migración 1.1 (enum) sola, en su propio despliegue de base de datos | `ALTER TYPE ... ADD VALUE` no puede compartir transacción con su uso posterior. |
| 2 | Migraciones 1.2 y 1.3 (columnas, RLS, funciones) | Ya pueden referenciar `AWAITING_PAYMENT` porque el paso 1 quedó confirmado. |
| 3 | `types/database.ts` actualizado, en el mismo commit que el paso 2 | Los tipos deben coincidir con lo que ya existe en la base antes de que el código nuevo los use. |
| 4 | Fase 2 (Server Actions) + Fase 7 (fix del gráfico) | Sin código de UI todavía; se puede probar por RPC/consola sin romper nada visible. |
| 5 | Fases 3 y 4 (UI repartidor y cliente) | El entregable visible; requieren que 1-2 ya estén en producción. |
| 6 | Fase 5 (pulido UX) | Mejoras no bloqueantes. |
| 7 | Checklist de la Fase 8 | Con las tres sesiones (repartidor, cliente, admin) disponibles. |

**Estado real (2026-09-27, plan cerrado):** los pasos 1 a 3 ya están hechos — las CINCO migraciones (`20260928100000` … `20260928100400`) están aplicadas al proyecto vinculado, en ese orden y confirmadas una por una (el enum quedó en su propia transacción, como exige Postgres) — y los pasos 4 a 6 están **implementados y verificados en local**: backend, UI de repartidor y cliente, pulido y el fix del gráfico, con `tsc`/`eslint`/`next build` en verde y las dos suites E2E pasando (49 + 28 verificaciones).

Lo que falta es de otra naturaleza, no de código pendiente:

1. **Desplegar el código** (pasos 4 en adelante) — todo el ciclo sigue sin commitear en `develop/fjp`.
2. Los ítems del checklist con **pantalla**: QR ampliado, inicial del avatar sin foto, gráfico de ingresos, distancia contra un mapa.
3. El ítem que necesita **sesión de admin en navegador** (desactivar/eliminar un repartidor con oferta activa).
4. ~~Decidir el hallazgo 1 de la Fase 8~~ — **decidido y aplicado**: el bypass se cerró (ver Hallazgos de la Fase 8). No queda ninguna decisión de código abierta.

Nota sobre las suites E2E: viven en `/scripts`, que está en `.gitignore`, así que no viajan con el commit. Para que el conocimiento no se pierda, la Fase 8 documenta cómo se corren y qué cubre cada una; si se quiere que sobrevivan al repo, hay que sacarlas de la ruta ignorada.

**Rollback:** revertir el código es seguro en cualquier punto después del paso 2 (las columnas quedan sin uso, nullable). **No** revertir la migración del enum (`AWAITING_PAYMENT` no se puede quitar de un tipo enum en Postgres sin recrear el tipo entero) — si hace falta deshacer, se deja el valor en el enum sin usar, nunca se borra.

---

## Resumen de archivos

Esta sección quedó como el plan la redactó (prospectiva). Abajo, lo que realmente se tocó. La Fase 7 (`DeliveryDashboardCharts.tsx` + `app/repartidor/page.tsx`) sí se hizo, y `OrderStatusTimeline.tsx` no necesitó cambios: itera `ORDER_STATUS_STEPS`, así que el paso nuevo apareció solo.

**Nuevos (reales):**

- `supabase/migrations/20260928100000_order_status_awaiting_payment.sql` — enum, en su propia transacción.
- `supabase/migrations/20260928100100_delivery_offer_columns.sql` — columnas + CHECKs de dinero.
- `supabase/migrations/20260928100200_delivery_offer_rls_and_functions.sql` — RLS + `confirm_delivery_payment` + `get_delivery_offer_profile`.
- `supabase/migrations/20260928100300_delivery_offer_functions.sql` — `offer_delivery` + `retract_delivery_offer` (no estaban en el plan; ver notas de la Fase 2).
- `supabase/migrations/20260928100400_expire_stale_delivery_offers.sql` — expiración de ofertas sin pagar (Fase 6, ítem 3).
- `lib/validations/delivery-offer.ts`
- `lib/actions/` no suma archivos: las acciones nuevas viven en los dos que ya existían.
- `app/api/v1/deliveries/[orderId]/offer/route.ts`, `.../retract/route.ts`
- `components/features/deliveries/SendOfferForm.tsx`, `RetractOfferButton.tsx`
- `components/features/orders/DeliveryPaymentCard.tsx`

**Modificados:**

- `types/database.ts` (columnas, enum, `Functions`), `types/order.ts` (union + `delivery_fee`)
- `lib/constants/order-status.ts`, `lib/admin/delivery-lifecycle.ts`
- `lib/actions/deliveries.ts`, `lib/actions/orders.ts`, `lib/actions/admin.ts` (solo el mensaje del bloqueo)
- `lib/api/auth.ts` (`userClient`), `lib/api/response.ts` (`rpcErrorResponse`)
- `app/api/v1/deliveries/[orderId]/accept/route.ts`, `advance/route.ts`, `app/api/v1/orders/route.ts`, `app/api/v1/orders/[id]/route.ts`
- `components/features/deliveries/AvailableOrdersClient.tsx`, `DeliveryOrdersClient.tsx`, `DeliveryOrderCard.tsx`
- `components/features/orders/OrdersListClient.tsx`, `OrderStatusBadge.tsx`, `OrderStatusSection.tsx`
- `components/features/admin/DeliveryAvatar.tsx` (prop `className` opcional)
- `app/cliente/pedidos/[id]/page.tsx`

**Agregados después (Fases 5 y 7):**

- `lib/geo/distance.ts` — Haversine + formato de distancia, sin dependencias.
- `lib/validations/delivery-offer.ts` — suma las constantes del dominio (mínimo, máximo, default) y `suggestedDeliveryFee()`.
- `components/features/deliveries/DeliveryDashboardCharts.tsx` y `app/repartidor/page.tsx` — corregido el origen de "Ingresos" (Fase 7, como decía el plan).
- `components/features/orders/OrdersListClient.tsx` — subtítulos de los dos banners corregidos por contraste (medido, no estimado).

**Eliminados:**

- `components/features/deliveries/AcceptOrderButton.tsx` — el formulario de oferta lo reemplaza (la acción `acceptOrder` y la ruta `/accept` sí se conservan, por contrato de la API v1).
