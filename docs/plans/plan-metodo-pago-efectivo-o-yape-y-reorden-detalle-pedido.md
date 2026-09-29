# Plan de Implementación — Método de Pago del Envío (Efectivo al recibir / Yape) + Reorden del Detalle de Pedido

**Proyecto:** PideloYa
**Módulo:** `/cliente/pedidos/[id]` (detalle de pedido del cliente) y, por extensión, `/repartidor/pedidos/**`
**Autor del plan:** revisión técnica estilo senior (+20 años), sobre el código real del repo.

**Alcance (los tres pedidos):**

1. Cuando el repartidor envía su oferta, el cliente elige **cómo pagar el envío**:
   - **Pagar aquí** → en efectivo, cuando le entreguen el pedido.
   - **Pagar ahora** (en tu mensaje: "Pagar por ahora") → aparece el QR del repartidor, su número y la subida del voucher (lo que existe hoy).
2. En el detalle del pedido, el **resumen del pedido va arriba** y **los estados del pedido abajo**.
3. **Ningún div debe deformarse** (alturas estiradas, columnas angostas, desbordes).

> **Nota sobre las skills (`ui-ux-pro-max`, `vercel-react-best-practices`, `supabase-postgres-best-practices`):** la ruta `C:\Users\ferna\.agents\skills` vive en tu máquina; mi entorno es un sandbox sin acceso a tu filesystem, así que no pude leer los `SKILL.md` (mismo caso ya documentado en tus planes anteriores). Aplico los principios que esas skills encapsulan y los cito en cada fase para que los contrastes: *ui-ux-pro-max* (una acción primaria por pantalla, revelado progresivo, objetivo táctil ≥ 40 px, no depender solo del color, estados vacíos/error como parte del diseño); *vercel-react-best-practices* (Server Components por defecto, sin componentes definidos dentro de otros, sin estado derivado copiado, carga diferida de lo pesado, evitar waterfalls); *supabase-postgres-best-practices* (migraciones aditivas, constraints como invariantes, funciones `SECURITY DEFINER` con `search_path` fijo, orden de locks consistente, RLS como fuente de verdad).

---

## Decisiones que conviene validar (léelas primero)

| # | Decisión | Por qué | Cómo se cambia |
|---|---|---|---|
| D1 | **La elección aplica al pago del ENVÍO** (lo que cobra el repartidor), no a la comida. | Hoy la plataforma solo modela el pago del envío (`deliveries.delivery_fee`); `orders.total` es la comida y nunca pasó por la app. | Si "efectivo" debe cubrir también la comida, cambia solo el **copy** y el monto mostrado (`total + envío`); el modelo de datos no cambia. **Confírmalo.** |
| D2 | **Sin opción preseleccionada.** El cliente debe elegir explícitamente. | Es dinero: preseleccionar Yape empuja a subir un voucher a quien quería efectivo; preseleccionar efectivo se presta a clics accidentales. El CTA explica por qué está deshabilitado. | Preseleccionar una es un `useState('YAPE')`. |
| D3 | **La elección es definitiva una vez confirmada** (el pedido pasa a `ASSIGNED`). | Cambiarla después obliga a reabrir el estado del pedido y a coordinar con el repartidor. Se avisa en el copy. | Permitir cambiarla exige una función SQL nueva y una regla de cuándo. |
| D4 | **`payment_method` como `text` + `CHECK`, no como enum.** | Es un dominio que va a crecer (Plin, tarjeta). Agregar un valor a un enum exige una migración separada (limitación ya sufrida con `AWAITING_PAYMENT`); un `CHECK` se reemplaza en una transacción. | Enum si prefieres uniformidad con `order_status`. |
| D5 | **`payment_confirmed_at` pasa a significar "el cliente cerró su elección de pago"**, para ambos métodos. | Todas las guardas existentes (retirar, expirar, cancelar, limpiar voucher) ya dependen de ese campo. Reutilizarlo evita tocar cuatro funciones. Se documenta con `comment on column`. | Alternativa: columna nueva `payment_settled_at` y migrar las guardas (más limpio, más invasivo). |
| D6 | **El repartidor confirma el cobro en efectivo al entregar** (`cash_collected_at`). | Es su única evidencia en efectivo y evita el "no me pagaron" en ambos sentidos. | Omitir Fase 6.3 si no lo quieres en esta iteración. |
| D7 | **Orden del detalle (móvil y escritorio, una sola columna):** Resumen → Pago (solo si `AWAITING_PAYMENT`) → Estados → Entrega. | El pedido pide Resumen arriba y Estados abajo; la tarjeta de pago es la acción pendiente y va pegada al resumen, donde está el monto. Ver causa raíz de la deformación en Fase 0. | Mover Pago debajo de Estados es cambiar una línea del JSX. |
| D8 | **Etiquetas propuestas:** "Pagar al recibir" y "Pagar ahora", con subtítulos. | "Pagar aquí" / "Pagar por ahora" solos son ambiguos ("¿aquí dónde?"). El significado que pediste se conserva en el subtítulo. | Todo el copy vive en una constante (`PAYMENT_METHOD_COPY`, Fase 2.1): cambiarlo es una línea. |

**Riesgo de producto a tener en mente (fuera del alcance mínimo):** un repartidor puede no querer cobrar en efectivo. Mitigación futura sencilla: un interruptor "Acepto pagos en efectivo" en su perfil que oculte la opción al cliente (Fase 10, "Mejoras futuras").

---

## Índice de fases

| Fase | Nombre | Tipo | Prioridad |
|---|---|---|---|
| 0 | Diagnóstico (incluye causa raíz de los divs deformados) | Lectura | — |
| 1 | Base de datos: `payment_method`, `cash_collected_at`, funciones | Migraciones SQL | Alta |
| 2 | Backend: constantes, validación, Server Actions, API v1, tipos | Backend | Alta |
| 3 | Layout del detalle: reorden y "cero deformación" | Frontend | **Alta (independiente, se puede desplegar sola)** |
| 4 | UI cliente: selector de método y paneles (Yape / efectivo) | Frontend / UX | Alta |
| 5 | Resumen y estados según el método elegido | Frontend | Media-Alta |
| 6 | Repartidor: cómo ve y cobra cada método | Frontend + backend | Alta |
| 7 | Ciclo de vida, limpieza y privacidad | Backend + legal | Media |
| 8 | Accesibilidad, motion y responsive | QA | No negociable |
| 9 | QA: suite E2E + checklist manual | QA | Obligatoria |
| 10 | Orden de despliegue, rollback y mejoras futuras | DevOps | Obligatoria |

**Orden recomendado:** `3` (independiente, resuelve lo visual hoy) → `1` → `2` → `4` → `5` → `6` → `7` → `8` → `9` → `10`.

---

## Fase 0 — Diagnóstico

### 0.1 — Cómo funciona hoy

- `PENDING` → el repartidor propone tarifa (`offer_delivery`) → `AWAITING_PAYMENT`.
- El cliente ve `DeliveryPaymentCard`: foto, tarifa, QR, número con botón de copiar, y **voucher obligatorio** → `confirm_delivery_payment(uuid, text)` → `ASSIGNED`.
- No existe el concepto de "método de pago": Yape + voucher es el único camino.

### 0.2 — Causa raíz de los divs deformados (verificada en `app/cliente/pedidos/[id]/page.tsx`)

La página usa **un solo grid plano** para todo:

```tsx
<div className="mt-6 grid gap-4 md:grid-cols-[1fr_22rem] md:items-stretch md:gap-6">
  <OrderStatusSection />              {/* hijo 1 */}
  {deliveryOffer && <DeliveryPaymentCard />}   {/* hijo 2 (condicional) */}
  <div className="h-fit md:sticky md:top-20"><OrderSummaryCard /></div>  {/* hijo 3 */}
  {entrega}                           {/* hijo 4 (condicional) */}
</div>
```

Tres defectos, todos estructurales:

1. **La columna de cada hijo depende de cuántos hijos condicionales existan.** El auto-placement del grid llena celdas en orden: sin oferta, el resumen cae en la columna angosta (22 rem); con oferta, **la tarjeta de pago cae en la columna de 22 rem** (el QR, el número y el picker de voucher se comprimen) y el resumen baja a la columna ancha. El layout cambia de forma según el estado del pedido.
2. **`items-stretch` estira las alturas.** Dos tarjetas que comparten fila miden lo mismo aunque una sea corta: quedan huecos vacíos dentro de la tarjeta menor. Es la "deformación" visible.
3. **`md:sticky` sobre un wrapper que ya es más alto que su contenido** (por el stretch) y `h-fit` mezclados con stretch: los dos fuerzan alturas contradictorias.

Además, sin `min-w-0` en los hijos del grid, un nombre de producto o una nota larga puede ensanchar la columna (los hijos de grid/flex tienen `min-width: auto`).

**Conclusión:** no es un problema de estilos sueltos; es un layout que **depende del contenido para colocar cada tarjeta**. La solución es eliminar el grid de dos columnas del detalle y usar una **pila vertical explícita** (Fase 3): el DOM refleja el orden pedido y ninguna tarjeta comparte fila con otra.

### 0.3 — Piezas que se reutilizan

`DeliveryPaymentCard`, `PaymentVoucherPicker`, `CopyButton`, `toVoucherJpeg`, `paymentVoucherPath`, `RealtimeRefresh` (ya montado en la página), `OrderStatusAnnouncer`, `OrderSummaryCard` (con su slot `voucher`), `ClientPageContainer`, bucket privado `payment-vouchers` con sus policies. **Nada del flujo Yape se rehace**: solo se mueve dentro de un panel que aparece cuando el cliente elige "Pagar ahora".

---

## Fase 1 — Base de datos

**Principios (supabase-postgres-best-practices):** migraciones aditivas y con backfill explícito; invariantes en `CHECK` (no solo en la app); operaciones multi-tabla en funciones `SECURITY DEFINER` con `search_path` fijo; orden de locks `orders → deliveries` (el mismo que `confirm_delivery_payment`, `retract_delivery_offer` y `expire_stale_delivery_offers`) para evitar deadlocks AB-BA.

Cuatro migraciones (timestamps de ejemplo; usar los reales al crearlas).

### 1.1 — `20261001100000_delivery_payment_method.sql`

```sql
-- ============================================================================
-- PideloYa — Método de pago del envío (YAPE | CASH)
-- ============================================================================
alter table public.deliveries
  add column if not exists payment_method text,
  add column if not exists cash_collected_at timestamptz;

alter table public.orders
  add column if not exists payment_method text;

-- Backfill ANTES de agregar los constraints: todo pago confirmado hasta hoy fue
-- por Yape (era el único método). Las filas sin confirmar quedan en NULL.
update public.deliveries
   set payment_method = 'YAPE'
 where payment_confirmed_at is not null
   and payment_method is null;

update public.orders o
   set payment_method = d.payment_method
  from public.deliveries d
 where d.order_id = o.id
   and d.payment_method is not null
   and o.payment_method is null;

-- Invariantes de datos (text + CHECK y no enum: el dominio va a crecer y un
-- CHECK se reemplaza en una transacción; ver D4).
alter table public.deliveries drop constraint if exists deliveries_payment_method_check;
alter table public.deliveries add constraint deliveries_payment_method_check
  check (payment_method is null or payment_method in ('YAPE', 'CASH'));

alter table public.orders drop constraint if exists orders_payment_method_check;
alter table public.orders add constraint orders_payment_method_check
  check (payment_method is null or payment_method in ('YAPE', 'CASH'));

-- El comprobante solo tiene sentido con Yape; el cobro en efectivo, solo con CASH.
alter table public.deliveries drop constraint if exists deliveries_voucher_requires_yape_check;
alter table public.deliveries add constraint deliveries_voucher_requires_yape_check
  check (payment_voucher_path is null or payment_method = 'YAPE');

alter table public.deliveries drop constraint if exists deliveries_cash_collected_requires_cash_check;
alter table public.deliveries add constraint deliveries_cash_collected_requires_cash_check
  check (cash_collected_at is null or payment_method = 'CASH');

comment on column public.deliveries.payment_method is
  'Cómo pagó el cliente el envío: YAPE (con comprobante) o CASH (al recibir). NULL mientras no eligió y en entregas legacy aceptadas sin oferta.';
comment on column public.deliveries.payment_confirmed_at is
  'Cuándo el cliente CERRÓ su elección de pago (Yape con comprobante o efectivo al recibir). Con CASH NO significa que el dinero ya se cobró: eso lo marca cash_collected_at. Todas las guardas de retirar/expirar/cancelar dependen de este campo.';
comment on column public.deliveries.cash_collected_at is
  'Cuándo el repartidor confirmó haber cobrado el envío en efectivo al entregar. Solo con payment_method = CASH.';
comment on column public.orders.payment_method is
  'Snapshot de deliveries.payment_method al confirmar. Sobrevive a la fila de deliveries (ON DELETE SET NULL del repartidor), igual que orders.delivery_fee.';
```

Notas:
- **Sin índice nuevo:** ninguna consulta filtra por método; agregar un índice sería costo de escritura sin lectura que lo use. Si un reporte futuro lo necesita, se agrega entonces.
- El orden importa: **backfill primero, constraints después**. Si se invierte, `deliveries_voucher_requires_yape_check` falla contra las filas históricas con voucher y sin método.
- Pedidos legacy aceptados sin oferta (ruta `accept` antigua) quedan `payment_method = NULL` en `ASSIGNED+`: la UI debe tolerarlo (Fase 5).

### 1.2 — `20261001100100_select_delivery_payment.sql`

Una función nueva que generaliza la confirmación. Se conserva **literalmente** el orden de validaciones de `confirm_delivery_payment` (identidad → existencia → dueño → idempotencia → estado → repartidor → tarifa) y sus `errcode`.

```sql
create or replace function public.select_delivery_payment(
  p_order_id uuid,
  p_method text,
  p_voucher_path text default null
)
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
  v_confirmed_at timestamptz;
begin
  if public.current_profile_id() is null then
    raise exception 'No autenticado' using errcode = '42501';
  end if;

  if p_method is null or p_method not in ('YAPE', 'CASH') then
    raise exception 'Método de pago inválido' using errcode = '22000';
  end if;

  -- Orden de locks: orders primero (igual que el resto del flujo).
  select o.customer_id, o.status, d.id, d.delivery_fee, d.payment_confirmed_at
    into v_customer_id, v_status, v_delivery_id, v_fee, v_confirmed_at
  from public.orders o
  left join public.deliveries d on d.order_id = o.id
  where o.id = p_order_id
  for update of o;

  if not found then
    raise exception 'Pedido no encontrado' using errcode = 'P0002';
  end if;
  if v_customer_id is distinct from public.current_profile_id() then
    raise exception 'No puedes confirmar el pago de un pedido que no es tuyo' using errcode = '42501';
  end if;
  if v_confirmed_at is not null then
    raise exception 'El pago de este pedido ya fue confirmado' using errcode = '23505';
  end if;
  if v_status is distinct from 'AWAITING_PAYMENT' then
    raise exception 'Este pedido no tiene una oferta de envío esperando confirmación' using errcode = '22000';
  end if;
  if v_delivery_id is null then
    raise exception 'No hay repartidor asociado a este pedido' using errcode = '22000';
  end if;
  if v_fee is null then
    raise exception 'El repartidor no definió una tarifa de envío' using errcode = '22000';
  end if;

  if p_method = 'YAPE' then
    -- Mismas dos validaciones de 20260930100300 (ruta canónica + archivo existente).
    if p_voucher_path is distinct from p_order_id::text || '/voucher.jpg' then
      raise exception 'Adjunta el comprobante de tu pago para confirmar' using errcode = '22000';
    end if;
    if not exists (
      select 1 from storage.objects
      where bucket_id = 'payment-vouchers' and name = p_voucher_path
    ) then
      raise exception 'No encontramos tu comprobante. Vuelve a subirlo e inténtalo de nuevo'
        using errcode = '22000';
    end if;
  elsif p_voucher_path is not null then
    -- CASH: un comprobante adjunto delata un cliente que quería Yape; no se
    -- adivina la intención, se rechaza.
    raise exception 'El pago en efectivo no lleva comprobante' using errcode = '22000';
  end if;

  update public.deliveries
     set payment_method = p_method,
         payment_confirmed_at = now(),
         accepted_at = now(),
         payment_voucher_path = case when p_method = 'YAPE' then p_voucher_path end
   where id = v_delivery_id
     and payment_confirmed_at is null;
  if not found then
    raise exception 'El pago de este pedido ya fue confirmado' using errcode = '23505';
  end if;

  update public.orders
     set status = 'ASSIGNED',
         delivery_fee = v_fee,
         payment_method = p_method
   where id = p_order_id
     and status = 'AWAITING_PAYMENT';
  if not found then
    raise exception 'El pedido cambió de estado antes de poder confirmar el pago' using errcode = '40001';
  end if;
end;
$$;

revoke all on function public.select_delivery_payment(uuid, text, text) from public, anon;
grant execute on function public.select_delivery_payment(uuid, text, text) to authenticated;

-- La función vigente pasa a ser un envoltorio: código desplegado que aún la
-- llame sigue funcionando Y deja payment_method = 'YAPE' (sin esto, el CHECK
-- deliveries_voucher_requires_yape_check rechazaría su UPDATE). Se elimina en
-- la migración de cierre (Fase 10).
create or replace function public.confirm_delivery_payment(p_order_id uuid, p_voucher_path text)
returns void
language sql
security definer
set search_path = public
as $$
  select public.select_delivery_payment(p_order_id, 'YAPE', p_voucher_path)
$$;
```

> **Trampa que este diseño evita:** si solo se agregaran las columnas y los `CHECK` sin tocar `confirm_delivery_payment`, la app **ya desplegada** empezaría a fallar en cada confirmación (escribe `payment_voucher_path` sin método). Por eso el envoltorio va en la **misma** migración.

### 1.3 — `20261001100200_complete_delivery.sql` (cobro en efectivo al entregar)

Hoy el último paso (`ON_THE_WAY → DELIVERED`) son dos `UPDATE` desde la Server Action (`orders` y `deliveries.delivered_at`), no atómicos. Para el efectivo hay que registrar el cobro **en la misma transacción**:

```sql
create or replace function public.complete_delivery(
  p_order_id uuid,
  p_cash_collected boolean default false
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid := public.current_profile_id();
  v_status public.order_status;
  v_delivery_id uuid;
  v_method text;
begin
  if v_profile_id is null then
    raise exception 'No autenticado' using errcode = '42501';
  end if;

  select status into v_status from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'Pedido no encontrado' using errcode = 'P0002';
  end if;

  select id, payment_method into v_delivery_id, v_method
  from public.deliveries
  where order_id = p_order_id and delivery_person_id = v_profile_id
  for update;
  if not found then
    raise exception 'No tienes este pedido asignado' using errcode = '42501';
  end if;

  if v_status is distinct from 'ON_THE_WAY' then
    raise exception 'El pedido no está en camino' using errcode = '22000';
  end if;

  if v_method = 'CASH' and p_cash_collected is not true then
    raise exception 'Confirma que cobraste el envío en efectivo antes de marcar la entrega'
      using errcode = '22000';
  end if;

  update public.deliveries
     set delivered_at = now(),
         cash_collected_at = case when v_method = 'CASH' then now() end
   where id = v_delivery_id;

  update public.orders set status = 'DELIVERED'
   where id = p_order_id and status = 'ON_THE_WAY';
  if not found then
    raise exception 'El pedido cambió de estado antes de marcarlo entregado' using errcode = '40001';
  end if;
end;
$$;

revoke all on function public.complete_delivery(uuid, boolean) from public, anon;
grant execute on function public.complete_delivery(uuid, boolean) to authenticated;
```

**Límite conocido y honesto:** la policy `orders_update_delivery_assigned` sigue permitiendo `DELIVERED` por PATCH directo, así que un repartidor técnico podría saltarse la confirmación de cobro. La app siempre pasa por la función. **Endurecimiento recomendado (Fase 10, tras validar E2E):** quitar `'DELIVERED'` del `with check` de esa policy, dejando la función como única puerta. No se hace en esta migración para no romper el flujo actual antes de migrar el código.

### 1.4 — Criterios de aceptación de la Fase 1

- [ ] Backfill: `select count(*) from deliveries where payment_confirmed_at is not null and payment_method is null` = 0.
- [ ] `select_delivery_payment(order,'CASH',null)` deja el pedido en `ASSIGNED`, con `payment_method='CASH'`, `payment_confirmed_at` y `orders.delivery_fee` poblados, sin `payment_voucher_path`.
- [ ] `select_delivery_payment(order,'CASH','<ruta>')` → `22000`.
- [ ] `select_delivery_payment(order,'YAPE',null)` → `22000` "Adjunta el comprobante".
- [ ] Método inválido (`'PLIN'`, `null`) → `22000`.
- [ ] Doble confirmación (cualquier método) → `23505`; pedido ajeno → `42501`; `anon` → `42501`.
- [ ] `confirm_delivery_payment(uuid,text)` (envoltorio) sigue funcionando y deja `payment_method='YAPE'`.
- [ ] `complete_delivery` en un pedido CASH sin `p_cash_collected=true` → `22000`; con `true` → `DELIVERED` y `cash_collected_at` poblado; en YAPE ignora el flag.
- [ ] Un `UPDATE` manual que ponga `cash_collected_at` con `payment_method='YAPE'` → `23514`.

---

## Fase 2 — Backend

### 2.1 — Constantes y copy en un solo lugar

`lib/constants/payment-method.ts`

```ts
export const PAYMENT_METHODS = ['YAPE', 'CASH'] as const
export type PaymentMethod = (typeof PAYMENT_METHODS)[number]

/** Todo el texto de la elección vive aquí: cambiar "Pagar al recibir" por
 *  "Pagar aquí" es una línea, no una búsqueda por el repo. */
export const PAYMENT_METHOD_COPY: Record<PaymentMethod, { title: string; subtitle: string; short: string }> = {
  CASH: {
    title: 'Pagar al recibir',
    subtitle: 'En efectivo, cuando te entreguen el pedido',
    short: 'Efectivo al recibir',
  },
  YAPE: {
    title: 'Pagar ahora',
    subtitle: 'Por Yape: escanea el QR y sube tu comprobante',
    short: 'Yape',
  },
}
```

### 2.2 — Validación en el borde (Zod)

`lib/validations/payment-method.ts`

```ts
import { z } from 'zod'
import { PAYMENT_METHODS } from '@/lib/constants/payment-method'
export const paymentMethodSchema = z.enum(PAYMENT_METHODS, { message: 'Elige cómo quieres pagar' })
```

### 2.3 — Server Action (`lib/actions/orders.ts`)

`confirmDeliveryPayment(orderId, method)` reemplaza la firma actual. El **navegador no elige la ruta del voucher** (igual que hoy): se deriva del `orderId` y solo se envía si el método es `YAPE`.

```ts
export async function confirmDeliveryPayment(orderId: string, method: PaymentMethod) {
  const parsed = paymentMethodSchema.safeParse(method)
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? 'Método de pago inválido')

  const supabase = await createClient()
  const { error } = await supabase.rpc('select_delivery_payment', {
    p_order_id: orderId,
    p_method: parsed.data,
    p_voucher_path: parsed.data === 'YAPE' ? paymentVoucherPath(orderId) : undefined,
  })
  if (error) throw new Error(error.message)

  revalidatePath('/cliente/pedidos')
  revalidatePath(`/cliente/pedidos/${orderId}`)
  revalidatePath('/repartidor/pedidos')
  return { success: true }
}
```

### 2.4 — Entrega final (`lib/actions/deliveries.ts::advanceOrderStatus`)

Para `ON_THE_WAY → DELIVERED`, delegar en `complete_delivery` (atómico) y aceptar un flag:

```ts
export async function advanceOrderStatus(orderId: string, currentStatus: OrderStatus, opts?: { cashCollected?: boolean }) {
  if (currentStatus === 'ON_THE_WAY') {
    const supabase = await createClient()
    const { error } = await supabase.rpc('complete_delivery', {
      p_order_id: orderId,
      p_cash_collected: opts?.cashCollected === true,
    })
    if (error) throw new Error(error.message)
    /* revalidatePath igual que hoy */
    return { success: true }
  }
  /* ...ramas ASSIGNED → PICKED_UP y PICKED_UP → ON_THE_WAY sin cambios... */
}
```

Se elimina el `timestampField: 'delivered_at'` del mapa `NEXT_STATUS` para ese paso (lo escribe la función).

### 2.5 — API v1 (paridad para consumidores externos)

- `PUT /api/v1/orders/[id]` `action: 'confirm_payment'`: acepta `{ method?: 'YAPE' | 'CASH' }`. **Sin `method` se asume `'YAPE'`** (compatibilidad con integraciones existentes). Llama a `select_delivery_payment` con `userClient(request)` (depende de `auth.uid()`; **no** usar `adminClient()`).
- `PUT /api/v1/deliveries/[orderId]/advance` (rol DELIVERY, paso `ON_THE_WAY`): llamar `complete_delivery` con `userClient`, body `{ cash_collected?: boolean }`. Para el rol ADMIN se mantiene el camino actual (override de soporte, sin exigir cobro).
- `rpcErrorResponse` ya mapea los `errcode` (42501→403, P0002→404, 23505/40001→409, resto 400): no requiere cambios.

### 2.6 — Tipos

- `types/database.ts`: `deliveries` (`payment_method`, `cash_collected_at`), `orders` (`payment_method`); `Functions`: `select_delivery_payment`, `complete_delivery`.
- `types/order.ts`: `ApiOrder.payment_method: PaymentMethod | null`; `deliveries.payment_method` y `deliveries.cash_collected_at` opcionales.

### 2.7 — Criterios de aceptación

- [ ] `pnpm run typecheck` sin errores.
- [ ] No queda ningún llamado a la firma vieja `confirmDeliveryPayment(orderId)` (`grep`).
- [ ] La API sin `method` sigue confirmando por Yape.

---

## Fase 3 — Layout del detalle: reorden y "cero deformación"

**Independiente de la Fase 1–2: se puede desplegar primero.** Es 100 % presentación.

### 3.1 — Principio

*Una pila vertical explícita en el orden del DOM.* Ninguna tarjeta comparte fila con otra, por lo que **no puede** haber stretch, ni columnas dependientes del estado, ni sticky contradictorio. El orden visual **es** el orden del DOM (mejor para lectores de pantalla y para el foco de teclado que reordenar con CSS `order`).

### 3.2 — Estructura nueva de `app/cliente/pedidos/[id]/page.tsx`

```tsx
<ClientPageContainer size="medium">
  <RealtimeRefresh /* igual que hoy */ />
  <OrderStatusAnnouncer status={order.status} />

  <header className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">{/* sin cambios */}</header>

  {/* Pila vertical: SIN grid, SIN items-stretch, SIN sticky. */}
  <div className="mt-6 flex flex-col gap-4">
    <OrderSummaryCard {...} />                                   {/* 1. Resumen — arriba */}
    {deliveryOffer && <DeliveryPaymentCard {...} />}             {/* 2. Acción pendiente (solo AWAITING_PAYMENT) */}
    <OrderStatusSection orderId={order.id} status={order.status} />  {/* 3. Estados — abajo */}
    {(order.addresses || order.notes) && <DeliveryInfoCard {...} />} {/* 4. Entrega */}
  </div>
</ClientPageContainer>
```

Por qué `flex flex-col` y no `grid`:
- `OrderStatusSection` devuelve `null` en `DELIVERED` y `DeliveryPaymentCard` es condicional. En una pila `flex-col` con `gap`, un hijo `null` **no deja hueco** (no genera caja); en un grid con celdas nombradas o filas compartidas sí puede descolocar el resto.
- Cada hijo mide **solo su contenido** (`align-items: stretch` en el eje transversal solo afecta el ancho, que es lo que queremos: todas iguales de ancho, ninguna forzada en alto).

### 3.3 — Ancho del contenedor

`components/layout/ClientPageContainer.tsx`: agregar `medium: 'max-w-2xl'` a `MAX_WIDTHS` (aditivo; `narrow` y `wide` no cambian). El detalle pasa de `wide` (`max-w-4xl`, pensado para dos columnas) a `medium`: en escritorio el contenido queda centrado y legible (≈ 672 px), sin tarjetas estiradas a 900 px.

> **Alternativa descartada (y por qué):** mantener dos columnas con áreas nombradas (`grid-template-areas`). Para que "Resumen arriba / Estados abajo" y "Pago" convivan, las filas del grid se comparten y aparecen huecos bajo la tarjeta más corta, que es justo la deformación que se quiere eliminar. Si más adelante se quiere aprovechar el ancho de escritorio, la vía segura es una columna lateral **independiente** (un `<aside>` con su propio `flex-col`, no celdas de un grid compartido); se deja como mejora futura.

### 3.4 — Reglas anti-deformación (aplicar a las 4 tarjetas)

1. **Todo hijo directo de la pila:** `w-full min-w-0`. `min-w-0` evita que un nombre largo ensanche la tarjeta.
2. **Ninguna altura fija ni `h-full`/`h-fit`** en tarjetas de contenido (solo en miniaturas: `h-11 w-11 shrink-0`).
3. **Texto largo:** nombres de producto `truncate` con `min-w-0 flex-1` (ya está); notas y direcciones `break-words [overflow-wrap:anywhere]`.
4. **Imágenes:** siempre dentro de un wrapper con dimensiones (`h-40 w-40 max-w-full`, `aspect-square`) y `object-contain`/`object-cover`; el QR nunca dicta el ancho de la tarjeta.
5. **Filas con acción a la derecha** (número + copiar, producto + precio): contenedor `flex items-center justify-between gap-3` con el bloque de texto `min-w-0` y la acción `shrink-0`.
6. **Diálogos:** `DialogContent` ya limita `max-h-[calc(100dvh-2rem)]` con scroll interno; no agregar alturas propias.
7. **Sin `overflow-hidden` en el contenedor de una tarjeta con controles enfocables** (recortaría el anillo de foco lima); usarlo solo en wrappers de imagen.

### 3.5 — Resumen que no empuja la acción fuera de pantalla

Con el resumen arriba, un pedido de 8 productos podría mandar el panel de pago debajo del pliegue en un móvil. Solución sin JS (Server Component): en `OrderSummaryCard`, cuando hay más de 3 productos, la lista va dentro de un `<details>` **cerrado por defecto**, con resumen "N productos · Ver detalle"; el desglose (Subtotal / Envío / Total) **siempre visible**. Con ≤ 3 productos se muestra todo, como hoy.

```tsx
{items.length > 3 ? (
  <details className="group mt-4">
    <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between text-sm font-medium">
      {items.length} productos
      <span className="text-xs text-muted-foreground group-open:hidden">Ver detalle</span>
      <span className="hidden text-xs text-muted-foreground group-open:inline">Ocultar</span>
    </summary>
    <ItemList items={items} />
  </details>
) : (
  <ItemList items={items} />
)}
```

`ItemList` se define **fuera** del componente (vercel-react-best-practices: nunca declarar componentes dentro de otro: se re-crea en cada render, se desmonta y se pierde el DOM).

### 3.6 — Estados abajo: jerarquía

En `OrderStatusSection` no cambia la lógica. Como ahora va debajo del resumen y de la acción, conserva su tarjeta con `shadow-client-card` (sigue siendo el "¿cómo va?"). Cuando el pedido está en `AWAITING_PAYMENT`, el paso activo del timeline se etiqueta **"Elige cómo pagar el envío"** (Fase 5.4).

### 3.7 — Criterios de aceptación

- [ ] Orden en móvil y escritorio: Resumen → (Pago) → Estados → Entrega, en una sola columna.
- [ ] La tarjeta de pago mide **el mismo ancho** que las demás en todos los estados (antes se comprimía a 22 rem).
- [ ] Ninguna tarjeta tiene alto artificial: cambiar de estado del pedido (PENDING → AWAITING_PAYMENT → ASSIGNED → DELIVERED) no mueve ni estira las demás salvo por aparecer/desaparecer.
- [ ] `DELIVERED`: sin timeline y **sin hueco** entre Resumen y Entrega.
- [ ] Un nombre de producto de 80 caracteres y una nota de 300 caracteres sin espacios no producen scroll horizontal (probar en 360 px).
- [ ] Con 8 productos, en 360 px el botón/paneles de pago quedan alcanzables sin scrollear más de una pantalla.
- [ ] `grep -n "items-stretch\|md:grid-cols-\[1fr_22rem\]\|md:sticky" app/cliente/pedidos/\[id\]/page.tsx` → 0 resultados.

---

## Fase 4 — UI cliente: selector de método y paneles

**Archivos:** `components/features/orders/DeliveryPaymentCard.tsx` (reestructura), `PaymentMethodChoice.tsx` (nuevo), `YapePaymentPanel.tsx` (nuevo, extraído), `CashPaymentPanel.tsx` (nuevo).

### 4.1 — Revelado progresivo (ui-ux-pro-max)

El cliente tiene **una decisión** y luego **una tarea** según lo que decidió. No se le muestran los tres pasos de Yape a quien va a pagar en efectivo.

```
┌──────────────────────────────────────────────┐
│ [foto]  Carlos Ríos llevará tu pedido          │
│         Costo de envío  S/ 7.50                │
├──────────────────────────────────────────────┤
│ ¿Cómo quieres pagar el envío?                  │
│ ┌────────────────────────────────────────────┐│
│ │ ( ) Pagar al recibir                        ││
│ │     En efectivo, cuando te entreguen…       ││
│ └────────────────────────────────────────────┘│
│ ┌────────────────────────────────────────────┐│
│ │ ( ) Pagar ahora                             ││
│ │     Por Yape: escanea el QR y sube…         ││
│ └────────────────────────────────────────────┘│
├──────────────────────────────────────────────┤
│ (según la elección)                            │
│  · CASH → resumen + [Confirmar pago en efectivo]│
│  · YAPE → 1 QR/número · 2 comprobante · [Ya pagué, confirmar]│
└──────────────────────────────────────────────┘
```

- **Sin opción preseleccionada (D2).** Mientras no elija, se muestra una línea de ayuda visible ("Elige una opción para continuar") y **ningún** CTA.
- **Un solo CTA lleno por estado** (una acción primaria por pantalla).

### 4.2 — El selector: radios nativos, accesibles gratis

```tsx
// PaymentMethodChoice.tsx — componente CONTROLADO y definido a nivel de módulo
'use client'
export function PaymentMethodChoice({ value, onChange, disabled }: {
  value: PaymentMethod | null
  onChange: (m: PaymentMethod) => void
  disabled?: boolean
}) {
  return (
    <fieldset disabled={disabled} className="min-w-0 space-y-2">
      <legend className="text-sm font-medium">¿Cómo quieres pagar el envío?</legend>
      {(['CASH', 'YAPE'] as const).map((m) => (
        <label key={m} className="block cursor-pointer">
          <input type="radio" name="payment-method" value={m} checked={value === m}
                 onChange={() => onChange(m)} className="peer sr-only" />
          <span className="flex min-h-14 items-start gap-3 rounded-2xl border border-black/10 bg-white p-3
                           transition-colors peer-checked:border-amber-500 peer-checked:bg-amber-100/60
                           peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-1
                           dark:border-white/10 dark:bg-white/5 dark:peer-checked:bg-amber-500/15">
            <span aria-hidden className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-current/40 peer-checked:...">…</span>
            <span className="min-w-0">
              <span className="block text-sm font-medium">{PAYMENT_METHOD_COPY[m].title}</span>
              <span className="block text-xs text-amber-900 dark:text-amber-100">{PAYMENT_METHOD_COPY[m].subtitle}</span>
            </span>
          </span>
        </label>
      ))}
    </fieldset>
  )
}
```

Por qué radios **nativos** y no un componente de librería: flechas de teclado, agrupación y lectura por lectores de pantalla vienen del navegador; el `<input>` va `sr-only` (no `hidden`) para seguir en el árbol de accesibilidad; el estado seleccionado **no depende solo del color** (borde + fondo + el círculo interior lleno). Objetivo táctil: toda la tarjeta (`min-h-14`).

### 4.3 — Panel Yape (extraído, sin cambios funcionales)

`YapePaymentPanel` recibe lo que hoy vive en `DeliveryPaymentCard`: QR (con su `Dialog` ampliable), fila del número con `CopyButton`, `PaymentVoucherPicker`, y el flujo `preparing → uploading → confirming` con `toVoucherJpeg` + `supabase.storage.upload(upsert)` + `confirmDeliveryPayment(orderId, 'YAPE')`. Se conservan **todos** los detalles ya validados: degradación sin QR / sin número, archivo conservado ante fallo, `router.refresh()` al terminar.

**Carga diferida (vercel-react-best-practices):** quien elige efectivo nunca necesita el compresor de imágenes ni el picker. `YapePaymentPanel` se importa con `next/dynamic` (`ssr: false`, con un esqueleto de la misma altura aproximada para no provocar salto de layout). Como el radio ya está elegido cuando se monta, la latencia es imperceptible.

### 4.4 — Panel efectivo

```tsx
// CashPaymentPanel.tsx
export function CashPaymentPanel({ fee, onConfirm, busy }: { fee: string; onConfirm: () => void; busy: boolean }) {
  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-black/5 bg-white p-4 dark:border-white/10 dark:bg-white/5">
        <p className="text-xs text-muted-foreground">Le pagarás al repartidor</p>
        <p className="text-2xl font-semibold tabular-nums">S/ {fee}</p>
        <p className="mt-1 text-xs text-amber-900 dark:text-amber-100">
          En efectivo, cuando te entregue el pedido. Si puedes, ten el monto exacto.
        </p>
      </div>
      <Button type="button" className="h-11 w-full rounded-full" onClick={onConfirm} disabled={busy}>
        {busy ? 'Confirmando…' : 'Confirmar pago en efectivo'}
      </Button>
      <p className="text-center text-xs text-amber-900 dark:text-amber-100">
        No podrás cambiar el método después de confirmar.
      </p>
    </div>
  )
}
```

- **Sin diálogo de confirmación extra** (evita fricción): el aviso "no podrás cambiarlo" está visible antes del clic (D3).
- Confirmar → `confirmDeliveryPayment(orderId, 'CASH')` → toast "¡Listo! Tu repartidor ya puede ir por tu pedido. Pagarás S/ X al recibirlo." → `router.refresh()`.

### 4.5 — Estado en `DeliveryPaymentCard` (vercel-react-best-practices)

```tsx
const [method, setMethod] = useState<PaymentMethod | null>(null)
const [phase, setPhase] = useState<Phase>('idle')
// `busy` se DERIVA, no se guarda: const busy = phase !== 'idle'
```

- Cambiar de método **no** borra el archivo elegido del voucher (el estado del picker vive en `YapePaymentPanel`, que se desmonta; si se quiere conservar al alternar, subir `file` al padre). Recomendado: subir `file` al padre: alternar por curiosidad no debe costarle al cliente volver a buscar su captura.
- Mientras `phase !== 'idle'`, el selector queda `disabled` (no se puede cambiar de método a mitad de una subida).
- Todos los subcomponentes se declaran a nivel de módulo, nunca dentro de `DeliveryPaymentCard`.

### 4.6 — Criterios de aceptación de la Fase 4

- [ ] Al aparecer la tarjeta no hay método seleccionado ni CTA; hay texto de ayuda.
- [ ] Elegir "Pagar al recibir" muestra el monto y **solo** el CTA de efectivo; no aparece QR ni picker.
- [ ] Elegir "Pagar ahora" muestra QR, número (con copiar) y picker; el CTA sigue deshabilitado hasta adjuntar el voucher y lo explica.
- [ ] Efectivo: `payment_method='CASH'`, `payment_voucher_path` nulo, pedido en `ASSIGNED`.
- [ ] Yape: idéntico a hoy + `payment_method='YAPE'`.
- [ ] Alternar CASH ↔ YAPE conserva el archivo ya elegido.
- [ ] Teclado: Tab llega al grupo, flechas cambian de opción, el foco se ve.
- [ ] Un repartidor sin QR ni número + método Yape mantiene el aviso punteado actual.
- [ ] El bundle inicial de `/cliente/pedidos/[id]` no incluye `compress-voucher` ni `PaymentVoucherPicker` hasta elegir Yape (verificar en el análisis de chunks de `next build`).

---

## Fase 5 — Resumen y estados según el método

### 5.1 — `OrderSummaryCard`

Nuevo prop opcional `paymentMethod?: PaymentMethod | null` y la fila "Envío" gana un chip:

| Estado | Fila "Envío" | Nota bajo el total |
|---|---|---|
| Sin oferta | `Por confirmar` | — |
| `AWAITING_PAYMENT` | `S/ 7.50` | "Elige cómo pagar el envío." |
| CASH | `S/ 7.50` + chip **Efectivo al recibir** | "Pagas S/ 7.50 en efectivo al repartidor cuando llegue tu pedido." |
| YAPE | `S/ 7.50` + chip **Yape** | "El envío se paga directo a tu repartidor por Yape." (texto actual) + fila del comprobante (slot `voucher`, sin cambios) |
| `NULL` tras ASSIGNED (legacy) | `S/ X` sin chip | Sin nota (no se inventa un método) |

El texto actual "El envío se paga directo a tu repartidor por Yape." **deja de ser universal**: hoy se muestra siempre que hay tarifa; debe condicionarse al método (si no, un cliente que eligió efectivo vería un texto falso).

### 5.2 — Página

`select` de `orders` agrega `payment_method` (no requiere cambiar `get_delivery_offer_details`, evitando el `DROP`+`CREATE` que rompería código desplegado).

### 5.3 — Estado post-elección para efectivo

En `ASSIGNED`/`PICKED_UP`/`ON_THE_WAY` con CASH, dentro de la tarjeta de estados (no una tarjeta nueva) una línea discreta y persistente: "Recuerda: pagas **S/ 7.50 en efectivo** al recibir." Es el único momento donde el cliente puede olvidarlo.

### 5.4 — Copy que cambia por el nuevo flujo

- `ORDER_STATUS_LABELS.AWAITING_PAYMENT`: "Confirma el pago del envío" → **"Elige cómo pagar el envío"**.
- `OrdersListClient` (banner): "Tu repartidor ya está listo — confirma el pago del envío" → "…elige cómo pagar el envío"; subtítulo "Toca aquí para elegir cómo pagar".
- `OrderStatusAnnouncer` (toast): "Revisa el monto y paga por Yape." → "Revisa el monto y elige cómo pagar."
- `QrCodeIcon` del banner de la lista: sigue sirviendo (o `WalletIcon`).

### 5.5 — Criterios de aceptación

- [ ] Un pedido CASH nunca muestra "por Yape" ni fila de comprobante.
- [ ] Un pedido YAPE se ve exactamente como hoy.
- [ ] Un pedido legacy con `payment_method` nulo no muestra chip ni texto de método.

---

## Fase 6 — Repartidor

### 6.1 — Lista "Mis entregas" (`DeliveryOrdersClient`)

En el pie de la tarjeta, según `order.deliveries.payment_method`:
- `AWAITING_PAYMENT`: sin cambios ("esperando que el cliente elija cómo pagar…" en vez de "confirme el pago") + `RetractOfferButton`.
- `CASH`: chip ámbar **"Cobrar S/ X en efectivo al entregar"** (el dato accionable).
- `YAPE`: indicador actual "Comprobante adjunto".

`GET /api/v1/orders` (rol DELIVERY) ya trae `deliveries(*)`, así que `payment_method` llega sin cambio de query.

### 6.2 — Detalle (`app/repartidor/pedidos/[id]/page.tsx`)

Agregar `payment_method, cash_collected_at` al `select` de `deliveries(...)`. Si `CASH`, un bloque **secundario** "Cobro en efectivo": monto grande, texto "Cobra al entregar" y, tras entregar, "Cobrado el {fecha}". El bloque de comprobante existente solo se renderiza con `YAPE` (ya depende de `payment_voucher_path`).

### 6.3 — Confirmar el cobro al entregar (D6)

`AdvanceStatusButton` recibe `paymentMethod` y, cuando `currentStatus === 'ON_THE_WAY' && paymentMethod === 'CASH'`:

1. El botón "Marcar entregado" abre un `ConfirmDialog` (el del proyecto): "¿Cobraste S/ 7.50 en efectivo?" con confirmación "Sí, cobré y entregué".
2. Al confirmar → `advanceOrderStatus(orderId, 'ON_THE_WAY', { cashCollected: true })` → `complete_delivery`.

Para Yape/legacy el botón funciona como hoy (sin diálogo). La guarda **real** vive en la función SQL; el diálogo es la UX.

### 6.4 — Ganancias

`DeliveryDashboardCharts` suma `delivery_fee` de entregas `DELIVERED`: sigue siendo correcto para ambos métodos. **Opcional:** desglosar "cobrado por Yape / en efectivo" en el tooltip (`delivery_fee` + `payment_method` ya viajan en el `select` de `app/repartidor/page.tsx`; agregar `payment_method`). No bloquea.

### 6.5 — Criterios de aceptación

- [ ] El repartidor ve el método elegido y, si es efectivo, el monto a cobrar, en la lista y en el detalle.
- [ ] No puede marcar entregado un pedido CASH sin confirmar el cobro (ni por Server Action ni por API).
- [ ] Un pedido YAPE se entrega sin diálogo extra.
- [ ] `cash_collected_at` queda poblado solo en CASH.

---

## Fase 7 — Ciclo de vida, limpieza y privacidad

| Caso | Efecto del nuevo método |
|---|---|
| Cliente cancela en `AWAITING_PAYMENT` | Sin cambios. Nada se eligió aún: no hay método ni voucher. |
| Repartidor retira / oferta expira | Sin cambios (siguen exigiendo `payment_confirmed_at is null`, que solo se pone al elegir). |
| Elección CASH | No genera archivo: `removeUnconfirmedVoucher` es no-op. Nada que limpiar. |
| Anonimizar cliente | El método (`YAPE`/`CASH`) no es dato personal; se conserva como parte del registro de la transacción. Los vouchers se siguen borrando como hoy. |
| Anonimizar repartidor con pedidos CASH | `cash_collected_at` es un timestamp de transacción, se conserva. |

**Política de Privacidad (`app/(public)/privacidad/page.tsx`):** no se recolecta un dato personal nuevo, pero el método de pago sí es información de la transacción; añadir una línea en la sección 2 ("Historial de pedidos… **y método de pago elegido para el envío**") y subir `UPDATED_AT` a la fecha del release (la sección 10 se compromete a publicar cada cambio con su fecha).

**Registro del proyecto:** agregar a `docs/decisions-and-learnings.md` D1–D8 y la lección "un grid plano con hijos condicionales coloca las tarjetas según el estado del contenido; usar pila vertical".

---

## Fase 8 — Accesibilidad, motion y responsive (no negociable)

1. **Contraste (medir, no estimar):** textos `text-xs` sobre `amber-50/60` → usar `amber-900` (≈ 8.9:1, ya medido en el ciclo anterior); tarjeta seleccionada `amber-100/60` con texto `foreground`; en oscuro `amber-500/15` con `amber-100`. Medir el nuevo chip "Efectivo al recibir" y el monto `text-2xl`.
2. **No depender del color:** selección = borde + fondo + círculo interior; método elegido en el resumen = **texto** del chip, no solo color.
3. **Foco visible:** los radios usan `peer-focus-visible:outline` con el lima global; ningún control nuevo usa `outline-none`.
4. **Objetivo táctil:** opciones `min-h-14`; CTA `h-11`; `summary` del detalle de productos `min-h-10`; botón copiar 40×40 (ya).
5. **Lector de pantalla:** `<fieldset>` + `<legend>`; la región `aria-live` de `OrderStatusAnnouncer` anuncia el nuevo estado; errores `role="alert"` junto al control; el `<details>` es semántico nativo.
6. **`prefers-reduced-motion`:** no se agregan animaciones nuevas; `animate-fade-up` de la tarjeta y el spinner ya están cubiertos por la regla global.
7. **Responsive (360, 428, 768, 1024+):** una sola columna en todos los anchos; sin scroll horizontal; el panel Yape mantiene QR de 160 px con `max-w-full`; con 8 productos el resumen colapsa (Fase 3.5).
8. **Sin salto de layout (CLS):** el esqueleto del `dynamic` de `YapePaymentPanel` reserva altura; el cambio de método no debe empujar el CTA bajo el teclado (no hay campos de texto en el flujo).

---

## Fase 9 — QA

### 9.1 — Suite E2E (`scripts/e2e-delivery-offer.mjs`, local y no versionada)

La suite actual llama `confirm_payment` sin cuerpo: sigue pasando por el default `YAPE`. Casos **nuevos**:

- `select_delivery_payment` CASH sin voucher → `ASSIGNED`, `payment_method='CASH'`, `delivery_fee` snapshot, `payment_voucher_path` nulo, `payment_confirmed_at` poblado.
- CASH con `p_voucher_path` → 400 "no lleva comprobante".
- YAPE sin voucher / con ruta ajena / sin archivo → 400 (regresión de los casos existentes vía la nueva función).
- Método inválido (`'PLIN'`, `null`) → 400.
- Doble confirmación mezclada (CASH luego YAPE) → 409.
- Cliente ajeno → 403; `anon` → 42501.
- CHECK: `update deliveries set cash_collected_at=now()` en una fila YAPE → 23514; `payment_voucher_path` en fila CASH → 23514.
- `complete_delivery`: CASH sin flag → 400; con flag → `DELIVERED` + `cash_collected_at`; YAPE ignora el flag; repartidor ajeno → 403; pedido no `ON_THE_WAY` → 400.
- Envoltorio `confirm_delivery_payment(uuid,text)` → deja `payment_method='YAPE'`.
- Cancelar / retirar / expirar siguen funcionando y no dejan `payment_method` (nada se eligió).
- API v1: `confirm_payment` sin `method` = YAPE; con `{method:'CASH'}` = CASH.
- Carrera: CASH confirmar vs. retirar oferta simultáneo → invariante (o queda `ASSIGNED` con método, o vuelve a `PENDING` sin método; nunca mixto).

### 9.2 — Checklist manual (necesita pantalla / dos sesiones)

- [ ] **Layout:** con 1, 3 y 8 productos, sin y con notas, en `PENDING`, `AWAITING_PAYMENT`, `ASSIGNED`, `DELIVERED`: orden Resumen → Pago → Estados → Entrega, sin huecos ni estirados, en 360 / 428 / 768 / 1280 px.
- [ ] Texto extremo (nombre de 80 caracteres, nota de 300 sin espacios): sin scroll horizontal.
- [ ] Tiempo real: la oferta llega a la página abierta y la tarjeta aparece con el selector, sin refrescar.
- [ ] Efectivo de punta a punta: cliente elige efectivo → repartidor ve "Cobrar S/ X" → marca entregado con diálogo → `cash_collected_at`.
- [ ] Yape de punta a punta (regresión completa del ciclo anterior).
- [ ] Alternar métodos conserva el archivo; cortar la red en Yape conserva el archivo.
- [ ] Modo oscuro, `prefers-reduced-motion`, TalkBack/VoiceOver en el flujo de elección.
- [ ] Pedido legacy (`payment_method` nulo, `ASSIGNED`): sin chip ni errores.
- [ ] Admin y restaurante: sin cambios.
- [ ] `pnpm run typecheck`, `pnpm run lint`, `pnpm run build` en verde.

---

## Fase 10 — Despliegue, rollback y mejoras futuras

### 10.1 — Orden de despliegue

| # | Paso | Por qué |
|---|---|---|
| 1 | **Fase 3 sola** (layout) | Sin base de datos, sin riesgo, resuelve lo visual hoy. |
| 2 | Migraciones 1.1 → 1.3 (`supabase db push`) | Solo agregan columnas/funciones; **el envoltorio de `confirm_delivery_payment` en 1.2 mantiene viva la app ya desplegada**. |
| 3 | `types/database.ts` en el mismo commit que el código | Los tipos deben coincidir con lo aplicado. |
| 4 | **Fases 2, 4, 5, 6, 7 juntas** | Cliente y repartidor deben ver el método a la vez: si el cliente pudiera elegir efectivo antes de que el repartidor sepa mostrarlo, el repartidor no sabría que debe cobrar. |
| 5 | QA de la Fase 9 con dos sesiones y un celular real | Verificación de punta a punta. |
| 6 | Migración de cierre `20261001100300_drop_confirm_delivery_payment_wrapper.sql` | Recién cuando ningún código llama `confirm_delivery_payment(uuid,text)`. Incluir el `rollback` verbatim en comentarios (mismo criterio que la migración de cierre anterior). |
| 7 | *(Opcional, tras validar E2E)* endurecer `orders_update_delivery_assigned` quitando `'DELIVERED'` del `with check` | Deja `complete_delivery` como única puerta al estado entregado. |

### 10.2 — Rollback

- Fase 3: revert de código, sin efectos en datos.
- Fases 2–7: revert de código es seguro (columnas y funciones quedan sin uso; el envoltorio mantiene la firma vieja funcionando).
- **No** hacer `drop column payment_method` si ya hay pedidos en efectivo: se perdería quién debía cobrar y quién ya cobró.
- Si se revierte **después** del paso 6, recrear la función de un argumento con el script de rollback de la migración de cierre.

### 10.3 — Mejoras futuras (fuera de alcance)

- Interruptor "Acepto pagos en efectivo" en el perfil del repartidor (oculta la opción CASH al cliente cuando no la acepta).
- Desglose de ingresos por método en el dashboard del repartidor (6.4).
- Un tercer método (Plin) es agregar un valor al `CHECK` y una entrada en `PAYMENT_METHOD_COPY` (beneficio directo de D4).
- Columna lateral independiente en escritorio (Fase 3.3, alternativa descartada).
- Si "efectivo" debe cubrir también la comida (D1): modelo de "quién cobra qué" (restaurante vs. repartidor) — merece su propio plan.

---

## Resumen de archivos

### Nuevos
- `supabase/migrations/20261001100000_delivery_payment_method.sql`
- `supabase/migrations/20261001100100_select_delivery_payment.sql`
- `supabase/migrations/20261001100200_complete_delivery.sql`
- `supabase/migrations/20261001100300_drop_confirm_delivery_payment_wrapper.sql` *(solo tras el paso 5 del despliegue)*
- `lib/constants/payment-method.ts`
- `lib/validations/payment-method.ts`
- `components/features/orders/PaymentMethodChoice.tsx`
- `components/features/orders/YapePaymentPanel.tsx`
- `components/features/orders/CashPaymentPanel.tsx`

### Modificados
- `app/cliente/pedidos/[id]/page.tsx` — pila vertical, orden nuevo, `payment_method` en el `select` (Fases 3, 5)
- `components/layout/ClientPageContainer.tsx` — tamaño `medium` (Fase 3)
- `components/features/orders/OrderSummaryCard.tsx` — `<details>` para > 3 productos, chip y notas por método (Fases 3, 5)
- `components/features/orders/DeliveryPaymentCard.tsx` — selector + paneles, estado `method` (Fase 4)
- `components/features/orders/OrderStatusSection.tsx` — recordatorio de efectivo (Fase 5)
- `components/features/orders/OrdersListClient.tsx`, `OrderStatusAnnouncer.tsx`, `lib/constants/order-status.ts` — copy (Fase 5)
- `lib/actions/orders.ts` — `confirmDeliveryPayment(orderId, method)` (Fase 2)
- `lib/actions/deliveries.ts` — `advanceOrderStatus` con `complete_delivery` (Fase 2, 6)
- `app/api/v1/orders/[id]/route.ts`, `app/api/v1/deliveries/[orderId]/advance/route.ts` — método y cobro (Fase 2)
- `components/features/deliveries/DeliveryOrdersClient.tsx`, `AdvanceStatusButton.tsx`, `app/repartidor/pedidos/[id]/page.tsx` — método y cobro (Fase 6)
- `types/database.ts`, `types/order.ts`
- `app/(public)/privacidad/page.tsx`
- `docs/decisions-and-learnings.md`
- `scripts/e2e-delivery-offer.mjs` *(local, no versionado)*

### Fuera de alcance (documentado a propósito)
- Verificación automática del pago (no hay pasarela: el voucher es **evidencia**, no **verificación**; no prometer más en la UI).
- Cambiar el método después de confirmar (D3).
- Cobro de la comida en efectivo (D1).
