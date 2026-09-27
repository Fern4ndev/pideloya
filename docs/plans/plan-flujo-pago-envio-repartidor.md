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
| 8 | QA — checklist de pruebas manuales | QA | Obligatoria |
| 9 | Orden de despliegue | DevOps | Obligatoria |

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

---

## Fase 5 — Detalles de UX

1. **Privacidad de la dirección (ver nota 3.2):** si el equipo decide no mostrar la dirección exacta a todos los repartidores navegando "Disponibles", la alternativa de menor esfuerzo es calcular la distancia en línea recta (fórmula de Haversine, sin dependencias nuevas) entre `restaurants.latitude/longitude` y `addresses.latitude/longitude`, y mostrar "≈ 2.3 km" en vez del texto de la dirección hasta que la oferta se confirme. Se documenta como alternativa, no como parte obligatoria de este plan.
2. **Tarifa sugerida por distancia (opcional, fase futura):** con la distancia ya calculada (punto anterior), se podría sugerir `Math.max(5, Math.ceil(distanciaKm) * 1.5)` como valor inicial del input en vez de un `5` fijo — mejora de producto, no de este ciclo.
3. **Nombre del repartidor:** mostrar el nombre completo (`full_name`) es consistente con lo que ya se le pide en el registro; si más adelante se quiere más privacidad, mostrar solo el primer nombre (`fullName.split(' ')[0]`) es un cambio de una línea en `DeliveryPaymentCard`.
4. **Accesibilidad:** el botón "Ya pagué, confirmar" debe tener suficiente contraste y un estado de carga claro (ya cubierto arriba); el QR en el `Dialog` necesita `alt="QR de Yape del repartidor"` (ya incluido) para lectores de pantalla, aunque un QR en sí no es "leíble" — el `alt` documenta qué es, no lo que dice.
5. **`prefers-reduced-motion`:** ninguna animación nueva de este plan (el `Dialog` ya respeta la regla global existente en `app/globals.css`).

---

## Fase 6 — Casos borde y ciclo de vida

1. **Cliente elimina/anonimiza su cuenta con una oferta `AWAITING_PAYMENT` activa:** `orders.customer_id` ya es `SET NULL` (migración `20260923130100`) — el pedido queda huérfano de cliente pero la oferta del repartidor sigue viva. Igual que hoy no hay limpieza automática de pedidos activos al eliminar un cliente (fuera del alcance ya documentado en `plan-manejo-eliminacion-cuentas.md`), este plan no lo resuelve tampoco — se señala como riesgo conocido heredado, no nuevo.
2. **Repartidor eliminado/desactivado con una oferta sin confirmar:** ya cubierto por la Fase 2.2 (`ACTIVE_DELIVERY_STATUSES` incluye `AWAITING_PAYMENT`): `deactivateUser()` lo bloquea, `deleteUser()` libera la oferta y regresa el pedido a `PENDING` vía `releaseActiveDeliveries`.
3. **Timeout de la oferta (recomendado, no incluido en el MVP):** si el cliente nunca confirma el pago, el pedido queda en `AWAITING_PAYMENT` indefinidamente y el repartidor queda "ocupado" para siempre. Se recomienda una Edge Function programada (`pg_cron` + función SQL, o un cron externo llamando a un endpoint) que, cada N minutos, retire ofertas con `offered_at` de más de, por ejemplo, 10 minutos sin `payment_confirmed_at`, reutilizando la misma lógica de `retractDeliveryOffer` (borrar la fila, volver a `PENDING`). Se deja como **Fase futura explícita** por el esfuerzo de infraestructura (cron) que no estaba en el alcance pedido, pero es la pieza que le falta a este diseño para ser 100% robusto en producción.
4. **Dos repartidores ofertando el mismo pedido a la vez:** la restricción `UNIQUE(order_id)` en `deliveries` (ya existente) es la red de seguridad real; `sendDeliveryOffer` ya traduce el error de restricción a un mensaje legible.
5. **El repartidor cambia de opinión sobre la tarifa antes de que el cliente pague:** se puede permitir editar `deliveries.delivery_fee` mientras `payment_confirmed_at is null`, con una policy `deliveries_update_delivery_self` que ya existe (`using (delivery_person_id = current_profile_id())`) — no requiere cambios de RLS, solo una acción `updateDeliveryOffer(orderId, fee)` en `lib/actions/deliveries.ts` análoga a 2.3. Se sugiere como mejora menor, no obligatoria para el MVP (el repartidor siempre puede retirar y volver a ofertar).

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

---

## Fase 8 — QA: checklist de pruebas manuales

- [ ] Migraciones aplicadas en orden: enum primero, columnas después, RLS/funciones al final (`supabase db push`).
- [ ] Un repartidor ve la dirección completa de un pedido `PENDING` en "Disponibles" y puede editar la tarifa antes de enviar la oferta.
- [ ] Enviar una oferta pasa el pedido a `AWAITING_PAYMENT`; el repartidor ya no puede ofertar en otro pedido ni aceptar uno directo.
- [ ] El cliente, en `/cliente/pedidos/[id]`, ve la tarjeta con la foto, el nombre y el QR del repartidor, y el monto correcto.
- [ ] Un repartidor **sin** foto o **sin** QR cargado: la tarjeta del cliente degrada con gracia (inicial en vez de foto rota; sin bloque de QR si `yape_qr_url` es `null`).
- [ ] Confirmar el pago avanza el pedido a `ASSIGNED`, el repartidor ve "Marcar como recogido" en "Mis entregas", y `orders.delivery_fee` queda poblado.
- [ ] Confirmar el pago dos veces seguidas (doble clic, o reintentar la Server Action) la segunda vez falla con un mensaje claro y no rompe nada.
- [ ] Retirar una oferta sin confirmar borra la fila de `deliveries`, el pedido vuelve a `PENDING`, y aparece de nuevo en "Disponibles" para otros repartidores.
- [ ] Retirar una oferta **después** de que el cliente confirmó el pago falla con un mensaje claro (no se puede deshacer un pago confirmado).
- [ ] Cancelar el pedido como cliente funciona tanto en `PENDING` como en `AWAITING_PAYMENT`; en este último caso, la oferta del repartidor queda huérfana — verificar que `cancelOrder()` también limpie la fila de `deliveries` (si no se implementó en la Fase 2, agregarlo antes de cerrar el ciclo).
- [ ] Desactivar/eliminar (desde `/admin`) a un repartidor con una oferta `AWAITING_PAYMENT` activa se bloquea (desactivar) o libera el pedido a `PENDING` (eliminar), igual que ya ocurre con `ASSIGNED`.
- [ ] Un cliente **no** puede leer `profiles` de ningún repartidor por la API REST directa (`select * from profiles`), solo vía la función RPC y solo para sus propios pedidos — probar con `curl` contra `/rest/v1/rpc/get_delivery_offer_profile` con el `order_id` de otro cliente: debe devolver cero filas.
- [ ] El gráfico "Ingresos generados" del repartidor (Fase 7) muestra la tarifa de envío, no el precio de la comida, en entregas nuevas.
- [ ] `pnpm run typecheck` y `pnpm run lint` sin errores nuevos.

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

**Rollback:** revertir el código es seguro en cualquier punto después del paso 2 (las columnas quedan sin uso, nullable). **No** revertir la migración del enum (`AWAITING_PAYMENT` no se puede quitar de un tipo enum en Postgres sin recrear el tipo entero) — si hace falta deshacer, se deja el valor en el enum sin usar, nunca se borra.

---

## Resumen de archivos

**Nuevos:**
- `supabase/migrations/<ts>_order_status_awaiting_payment.sql`
- `supabase/migrations/<ts>_delivery_offer_columns.sql`
- `supabase/migrations/<ts>_delivery_offer_rls_and_functions.sql`
- `lib/validations/delivery-offer.ts`
- `components/features/deliveries/SendOfferForm.tsx`
- `components/features/deliveries/RetractOfferButton.tsx`
- `components/features/orders/DeliveryPaymentCard.tsx`

**Modificados:**
- `types/database.ts`, `types/order.ts`
- `lib/constants/order-status.ts`
- `lib/admin/delivery-lifecycle.ts`
- `lib/actions/deliveries.ts`, `lib/actions/orders.ts`
- `app/api/v1/deliveries/**`, `app/api/v1/orders/[id]/route.ts`
- `components/features/deliveries/AvailableOrdersClient.tsx`, `DeliveryOrdersClient.tsx`, `DeliveryOrderCard.tsx`
- `components/features/orders/OrderStatusTimeline.tsx`, `OrdersListClient.tsx`, `OrderStatusBadge.tsx`
- `components/features/deliveries/DeliveryDashboardCharts.tsx`, `app/repartidor/page.tsx`
- `app/cliente/pedidos/[id]/page.tsx`
