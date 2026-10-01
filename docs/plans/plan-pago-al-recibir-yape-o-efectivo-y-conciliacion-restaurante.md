# Plan de Implementación — "Pagar al recibir" con Yape o Efectivo, cobro verificado por el repartidor y conciliación con el restaurante

**Proyecto:** PideloYa
**Módulos:** `/cliente/pedidos/[id]` · `/repartidor/pedidos/**` · `/restaurante/pedidos` · `/admin`
**Fecha del plan:** 2026-09-29
**Base:** código real del repo (migraciones hasta `20261001100200_complete_delivery.sql`, `select_delivery_payment`, `complete_delivery`, `DeliveryPaymentCard`, `AdvanceStatusButton`, `app/repartidor/pedidos/[id]/page.tsx`).

> **Nota sobre skills y asesoría:** las skills locales (`ui-ux-pro-max`, `vercel-react-best-practices`, `supabase-postgres-best-practices`) viven en tu máquina y no pude leerlas; el plan aplica los mismos principios que el proyecto ya cita en planes anteriores (revelado progresivo, una acción primaria por pantalla, objetivo táctil ≥ 40 px, no depender solo del color, migraciones aditivas *expand/contract*, invariantes en `CHECK`, funciones `SECURITY DEFINER` con `search_path` fijo, orden de locks `orders → deliveries`). Lo que toca **legal/tributario** (boletas, quién es el "vendedor", retención) no es una decisión de código: se marca como *"validar con contador/abogado"* y no lo resuelvo yo.

---

## 0. Resumen ejecutivo

### Lo que pides

1. Cuando el cliente elige **"Pagar al recibir"**, poder decidir **con qué** paga: **Efectivo** o **Yape**.
2. Que en el **panel del repartidor** se vea, en los detalles de la entrega, **su QR de Yape** y que **él verifique** que el pago es correcto antes de cerrar la entrega.
3. Cerrar el punto de la revisión: *"con pago en efectivo el restaurante no recibe la plata de la comida por ninguna vía del sistema"*.

### Respuesta corta a cada punto

| Punto | Respuesta |
|---|---|
| **Pagar al recibir + Yape** | Se modela en **dos ejes independientes**: *cuándo* paga (`UPFRONT` = ahora, con comprobante; `ON_DELIVERY` = al recibir) y *con qué* (`YAPE` / `CASH`). "Pagar al recibir" abre un segundo paso *"¿Con qué pagarás?"* (Efectivo / Yape), sin opción preseleccionada. Combinación inválida: `CASH + UPFRONT`. |
| **QR y verificación en el repartidor** | Sí, en el detalle de la entrega y en el momento del cobro: botón grande **"Mostrar mi QR"** (pantalla completa con monto), y al marcar entregado un diálogo **"¿Cómo te pagó?"** con atestación explícita *("Ya vi el yapeo de S/ X en mi app de Yape")*. **El sistema no puede verificar Yape** (no hay integración bancaria): la verificación real la hace el repartidor en su propia app; nosotros registramos *quién declaró qué y cuándo*. |
| **Observación de la revisión** | La observación es **correcta sobre el sistema, pero su premisa no describe tu negocio**. Como el repartidor *compra* el pedido con su propio dinero al recogerlo, el restaurante **sí cobra** — solo que por una vía que hoy la app no ve. El riesgo real no es "el restaurante no cobra", es **"nadie puede probar que cobró"** y **"el repartidor adelanta plata sin protección"**. El plan agrega: constancia de pago al restaurante, visibilidad para el restaurante, incidencias y protección del repartidor. |

### Hallazgo importante que debes validar (D1)

Hoy el código maneja **dos montos distintos según el método**:

- **Efectivo:** el cliente entrega `orders.total + delivery_fee` (comida + envío) — `cashAmountDue()`.
- **Yape "Pagar ahora":** el QR/diálogo dice *"transfiere S/ {fee}"* → **solo el envío** (`YapePaymentPanel`, y la nota del resumen *"El envío se paga directo a tu repartidor por Yape"*).

Con tu explicación (*"cuando le yapean el dinero al principio o al recibir, él pone de su plata para comprar el pedido"*) el modelo es: **el cliente le paga al repartidor TODO (comida + envío), siempre; el repartidor paga la comida al restaurante al recoger**. Si eso es correcto, **hay que unificar** y el Yape "por adelantado" también debe ser por `comida + envío`. Es un cambio de copy, de monto en QR/comprobante y de la nota del resumen (Fase 4). **Si en realidad el Yape por adelantado debe seguir siendo solo el envío, el repartidor terminaría adelantando la comida en TODOS los casos, y eso contradice lo que describes.**

---

## 1. Cómo circula el dinero (modelo de negocio que este plan asume)

```
CLIENTE ──(comida + envío)──► REPARTIDOR ──(comida)──► RESTAURANTE
          Yape ahora │ Yape al recibir │ Efectivo al recibir     paga al RECOGER
                                                                (efectivo o su Yape)
```

| Caso | ¿Cuándo tiene el repartidor la plata del cliente? | ¿Con qué dinero paga al restaurante? | Riesgo del repartidor |
|---|---|---|---|
| **Yape ahora** (UPFRONT) | Antes de comprar (ya la yapearon) | Con el dinero del cliente | Bajo |
| **Yape al recibir** (ON_DELIVERY) | Después de entregar | **Con su propio dinero** (adelanto) | **Medio**: cliente que no paga |
| **Efectivo al recibir** (ON_DELIVERY) | Después de entregar | **Con su propio dinero** (adelanto) | **Medio**: cliente que no paga |

**Consecuencias de diseño:**

1. **PideloYa no toca dinero.** No custodia, no liquida, no concilia bancariamente. Lo que sí debe hacer es **dejar evidencia** de cada tramo (cliente→repartidor, repartidor→restaurante).
2. **El restaurante gana lo mismo en los tres casos.** Sus ventas (`order_items`) ya se calculan sin depender del método; no cambia ningún dashboard.
3. **El único que asume riesgo financiero es el repartidor** en los casos ON_DELIVERY. Por eso el plan incluye protecciones (Fase 7) en vez de solo "otra pantalla".
4. **Ninguna pantalla debe prometer verificación automática.** El comprobante y la atestación son *evidencia*, no *verificación*.

---

## 2. Decisiones que conviene validar (léelas primero)

| # | Decisión | Por qué | Cómo se cambia |
|---|---|---|---|
| **D1** | **Monto unificado:** en TODO método el cliente paga al repartidor `comida + envío` (`amountDueToCourier`). | Coherente con "el repartidor compra el pedido". Hoy Yape-ahora cobra solo el envío (ver §0). | Si Yape-ahora debe seguir siendo solo envío, se elimina esa parte de la Fase 4.4 y el repartidor adelanta la comida siempre. **Confírmalo.** |
| **D2** | **Dos ejes** (`payment_timing` + `payment_method`) y no un tercer valor `YAPE_ON_DELIVERY`. | La UI tiene exactamente dos decisiones; el repartidor reacciona a cada eje por separado (mostrar QR ⇐ método Yape; exigir comprobante ⇐ timing UPFRONT). Un valor compuesto obliga a `if` anidados en toda la app. | Alternativa: 3 valores en `payment_method`; menos columnas pero semántica más confusa. |
| **D3** | **Sin preselección** en ningún nivel (ni "cuándo" ni "con qué"). | Es dinero (regla D2 del plan anterior). | Una línea de `useState`. |
| **D4** | **El cobro al recibir lo declara el repartidor** (`collected_at` + `collected_method`) y puede diferir de lo que el cliente anunció. | En la puerta pasa que dijo "Yape" y paga en efectivo (o al revés). Bloquear eso es fricción inútil; **registrarlo** es lo correcto. | Forzar que coincida = quitar el selector de la Fase 5.3. |
| **D5** | **Yape al recibir NO lleva comprobante del cliente.** | El comprobante es un paso previo (antes de comprar). En la puerta, lo que existe es la app de Yape del repartidor. Subir captura a la puerta duplica trabajo y no prueba nada que el repartidor no vea ya. | Mejora futura: captura opcional post-pago (§11). |
| **D6** | **El repartidor declara "Pagué al restaurante"** al marcar recogido (`orders.restaurant_paid_at`). | Es la única evidencia de que la comida se pagó. Snapshot en `orders` (no en `deliveries`) para que **el restaurante pueda verlo con las policies que ya tiene** y sobreviva si se borra al repartidor. | No hacerlo obligatorio en DB (ya es obligatorio en UI); ver Fase 6. |
| **D7** | **Toggle del repartidor "Acepto pago al recibir"** (default `true`) con snapshot por oferta. | Quien no quiera adelantar dinero debe poder negarse **antes** de ofertar, no descubrirlo al elegir el cliente. Default `true` = mismo comportamiento de hoy (el efectivo ya existe). | Sin toggle: todos los repartidores aceptan ON_DELIVERY. |
| **D8** | **"No pude cobrar" es un flujo explícito** que crea una incidencia y NO marca el pedido entregado. | Hoy el repartidor solo puede "entregar" o quedarse en el limbo. Sin esta salida, el incentivo es marcar entregado sin cobrar. | Es la Fase 8; puede diferirse pero deja un hueco de honestidad. |
| **D9** | **Sin nuevos estados de pedido** (`order_status` no cambia). | Evita el problema del enum (`AWAITING_PAYMENT`). Todo cuelga de columnas y funciones. | — |
| **D10** | **Boleta/factura y "quién vende"** quedan fuera del código; requieren contador. | Es una definición tributaria: ¿el restaurante emite al cliente o al repartidor? Afecta el texto de Términos. | Ver Fase 9. |

---

## 3. Diagnóstico: qué hay hoy y qué cambia

**Ya existe y se reutiliza (no se rehace):**
`payment_method` (`YAPE|CASH`) en `deliveries` y `orders`; `select_delivery_payment(uuid,text,text)`; `complete_delivery(uuid,boolean)`; `cash_collected_at`; bucket privado `payment-vouchers`; `PaymentMethodChoice`, `CashPaymentPanel`, `YapePaymentPanel`, `DeliveryPaymentCard` (con `next/dynamic`); `get_delivery_offer_details` (ya entrega `yape_qr_url` y `phone` en estados vivos); `CopyButton`; `ConfirmDialog`; `RealtimeRefresh`; `PaymentVoucherViewer`; `cashAmountDue()`.

**Lo que hoy NO puede expresarse:**

| Limitación actual | Dónde |
|---|---|
| "Al recibir" == efectivo (`CASH` implica ON_DELIVERY y no hay otra opción) | `PaymentMethodChoice` (2 opciones fijas), CHECKs |
| Yape solo existe con comprobante previo | `deliveries_voucher_requires_yape_check`, `select_delivery_payment` |
| El cobro se registra solo para CASH | `cash_collected_at`, `deliveries_cash_collected_requires_cash_check`, `complete_delivery` |
| El repartidor no ve su QR en el detalle de la entrega | `app/repartidor/pedidos/[id]/page.tsx` (solo muestra comprobante o bloque de efectivo) |
| Nadie registra que se pagó la comida al restaurante | no existe |
| El restaurante no ve nada del pago | `RestaurantOrdersTable`/`OrderDetailsDialog` |
| El repartidor no puede negarse a adelantar plata ni reportar impago | no existe |
| Montos inconsistentes por método (D1) | `YapePaymentPanel` vs `cashAmountDue` |

---

## 4. Índice de fases

| Fase | Nombre | Tipo | Prioridad | Estimación |
|---|---|---|---|---|
| 1 | Base de datos: eje `payment_timing`, cobro genérico, constancia al restaurante (*expand*) | Migraciones | **Alta** | 1 día |
| 2 | Backend: constantes, validación, Server Actions, API v1, tipos | Backend | **Alta** | 1 día |
| 3 | UI Repartidor — detalle de entrega, QR grande y cobro verificado | Frontend/UX | **Alta** | 2 días |
| 4 | UI Cliente — "Pagar al recibir" → ¿Con qué? + monto unificado (D1) | Frontend/UX | **Alta** | 1.5 días |
| 5 | Repartidor — compra en el restaurante ("Pagué al restaurante") | Frontend + backend | **Alta** | 1 día |
| 6 | Restaurante — visibilidad del pago | Frontend | Media-Alta | 0.5 día |
| 7 | Protección del repartidor (toggle, aviso de adelanto) | Full-stack | Media-Alta | 1 día |
| 8 | Incidencias: "No pude cobrar" + conciliación admin | Full-stack | Media | 1.5 días |
| 9 | Privacidad, Términos y aspectos tributarios | Legal/contenido | Media | 0.5 día + asesoría |
| 10 | Accesibilidad, motion, responsive | QA | **No negociable** | transversal |
| 11 | QA: E2E + checklist manual | QA | Obligatoria | 1.5 días |
| 12 | Despliegue, *contract*, rollback | DevOps | Obligatoria | 0.5 día |

**Orden de ejecución recomendado:** `1 → 2 → 3 → 5 → 4 → 6 → 7 → 8 → 9 → 10 → 11 → 12`.
**Por qué la UI del repartidor (3 y 5) va ANTES que la del cliente (4):** si el cliente pudiera elegir "Yape al recibir" antes de que el repartidor sepa mostrarlo, el repartidor recibiría una entrega con un cobro que su pantalla no entiende. La UI del repartidor es retrocompatible (no muestra nada nuevo mientras no exista una elección nueva), así que se puede desplegar primero sin riesgo.

---

## Fase 1 — Base de datos (patrón *expand*, aditivo y compatible con la app desplegada)

**Principios:** ninguna columna existente se borra ni se renombra en esta fase; el código actualmente desplegado debe seguir funcionando entre el `db push` y el despliegue de la app; backfill **antes** de los constraints; invariantes en `CHECK`; misma convención de `errcode`.

### 1.1 — `20261002100000_payment_timing_and_collection.sql`

```sql
-- Eje "cuándo": UPFRONT (ahora, con comprobante) | ON_DELIVERY (al recibir).
alter table public.deliveries
  add column if not exists payment_timing text,
  add column if not exists collected_at timestamptz,
  add column if not exists collected_method text,      -- lo que REALMENTE se cobró
  add column if not exists allows_pay_on_delivery boolean not null default true; -- snapshot D7

alter table public.orders
  add column if not exists payment_timing text,
  add column if not exists restaurant_paid_at timestamptz;   -- D6

-- Backfill ANTES de los constraints: todo lo elegido hasta hoy es coherente.
update public.deliveries set payment_timing =
  case payment_method when 'YAPE' then 'UPFRONT' when 'CASH' then 'ON_DELIVERY' end
 where payment_method is not null and payment_timing is null;

update public.orders o set payment_timing = d.payment_timing
  from public.deliveries d
 where d.order_id = o.id and d.payment_timing is not null and o.payment_timing is null;

-- El cobro en efectivo ya registrado pasa al campo genérico.
update public.deliveries
   set collected_at = cash_collected_at, collected_method = 'CASH'
 where cash_collected_at is not null and collected_at is null;

-- Invariantes
alter table public.deliveries add constraint deliveries_payment_timing_check
  check (payment_timing is null or payment_timing in ('UPFRONT','ON_DELIVERY'));
alter table public.orders add constraint orders_payment_timing_check
  check (payment_timing is null or payment_timing in ('UPFRONT','ON_DELIVERY'));

-- Efectivo solo existe "al recibir".
alter table public.deliveries add constraint deliveries_cash_is_on_delivery_check
  check (payment_method is distinct from 'CASH' or payment_timing = 'ON_DELIVERY');

-- Método y timing viajan juntos (o ninguno): evita filas a medias.
alter table public.deliveries add constraint deliveries_method_timing_pair_check
  check ((payment_method is null) = (payment_timing is null));

-- Comprobante: SOLO Yape por adelantado. Reemplaza al check anterior (más laxo).
alter table public.deliveries drop constraint if exists deliveries_voucher_requires_yape_check;
alter table public.deliveries add constraint deliveries_voucher_requires_upfront_yape_check
  check (payment_voucher_path is null
         or (payment_method = 'YAPE' and payment_timing = 'UPFRONT'));

-- Cobro: solo cuando se paga al recibir, con un medio válido.
alter table public.deliveries add constraint deliveries_collected_check
  check (collected_at is null
         or (payment_timing = 'ON_DELIVERY' and collected_method in ('YAPE','CASH')));
alter table public.deliveries add constraint deliveries_collected_pair_check
  check ((collected_at is null) = (collected_method is null));
```

**Notas de diseño:**
- **`cash_collected_at` y su CHECK (`..._requires_cash_check`) se conservan** durante toda la transición; `complete_delivery` dual-escribe (Fase 1.3) y se eliminan en la Fase 12 (*contract*). Renombrar ya rompería `app/repartidor/pedidos/[id]/page.tsx` desplegado.
- **`restaurant_paid_at` vive en `orders`** (no en `deliveries`) a propósito: la policy `orders_select_restaurant_readonly` ya permite al restaurante leer sus pedidos, sin abrir nada en `deliveries`.
- Sin índices nuevos (mismo criterio que `payment_method`); la única excepción probable es el de la Fase 8 (incidencias).
- `comment on column` en cada columna nueva. Especialmente: *"`collected_method` es lo que el repartidor declaró haber recibido; puede diferir de `payment_method` (lo que el cliente anunció)"*.

### 1.2 — `20261002100100_select_delivery_payment_v2.sql`

Se redefine `select_delivery_payment` con un cuarto parámetro `p_timing text default null`. **Es `create or replace` con una firma nueva → crearía una sobrecarga**; para no dejar dos funciones ambiguas, se hace `drop` de la firma `(uuid,text,text)` y `create` de la nueva **en la misma transacción** (atómico: no hay ventana sin función). Los llamadores actuales (`p_order_id`, `p_method`, `p_voucher_path`) siguen resolviendo porque el 4.º parámetro tiene default.

Reglas (mismo orden de validaciones y `errcode` de la versión vigente: identidad → método/timing válidos → existencia → dueño → idempotencia → estado → repartidor → tarifa → específicas):

| `p_method` | `p_timing` | Resultado |
|---|---|---|
| `YAPE` | `null` / `UPFRONT` | Igual que hoy: comprobante **obligatorio** y existente en Storage. |
| `YAPE` | `ON_DELIVERY` | **Nuevo.** `p_voucher_path` debe ser `null` (si no, `22000` "El pago al recibir no lleva comprobante"). Requiere `deliveries.allows_pay_on_delivery`. |
| `CASH` | `null` / `ON_DELIVERY` | Igual que hoy (+ requiere `allows_pay_on_delivery`). |
| `CASH` | `UPFRONT` | `22000` "El efectivo solo se paga al recibir". |
| cualquiera | otro valor | `22000` "Momento de pago inválido". |

**Derivación cuando `p_timing` es null** (compatibilidad con la app ya desplegada): `YAPE → UPFRONT`, `CASH → ON_DELIVERY`. Así el código viejo sigue produciendo exactamente lo mismo.

Nuevo rechazo: `ON_DELIVERY` con `allows_pay_on_delivery = false` → `22000` "Este repartidor solo acepta pago por adelantado" (D7).

Escribe: `deliveries.{payment_method, payment_timing, payment_confirmed_at, accepted_at, payment_voucher_path}` y `orders.{status, delivery_fee, payment_method, payment_timing}`.

> Recordatorio: `payment_confirmed_at` ya significa *"el cliente cerró su elección"* (D5 del plan anterior). Con ON_DELIVERY **no** significa que hubo dinero; eso lo marca `collected_at`.

Mantener el envoltorio `confirm_delivery_payment(uuid,text)` → delega con `('YAPE', voucher, 'UPFRONT')`.

### 1.3 — `20261002100200_complete_delivery_v2.sql`

Se hace `drop function public.complete_delivery(uuid, boolean)` + `create` con `(p_order_id uuid, p_cash_collected boolean default false, p_collected_method text default null)`, todo en una transacción.

Lógica:
1. Mismos locks y guardas (identidad, pertenencia por fila, estado `ON_THE_WAY`, `40001` si cambió).
2. Si `payment_timing = 'ON_DELIVERY'`:
   - Se **exige** confirmar el cobro: `p_cash_collected is true` (nombre legado; semánticamente "cobré") **o** `p_collected_method is not null`. Si no → `22000` "Confirma que cobraste antes de marcar la entrega".
   - `collected_method = coalesce(p_collected_method, payment_method)` (los llamadores viejos, que solo mandan el flag, quedan como antes: `CASH`).
   - Si `p_collected_method` no es `YAPE|CASH` → `22000`.
   - Escribe `collected_at = now()`, `collected_method`, y **dual-escribe** `cash_collected_at = now()` cuando `collected_method = 'CASH'` (compatibilidad).
3. Si `UPFRONT` (o legacy sin método): ignora los flags, como hoy.
4. `delivered_at = now()`, `orders.status = 'DELIVERED'` con el `if not found → 40001`.

### 1.4 — `20261002100300_pickup_delivery.sql`

`pickup_delivery(p_order_id uuid, p_restaurant_paid boolean default false)`, `SECURITY DEFINER`:
- Guardas iguales a `complete_delivery` pero para `ASSIGNED → PICKED_UP` (`picked_up_at = now()`).
- Si `p_restaurant_paid is true` → `orders.restaurant_paid_at = coalesce(restaurant_paid_at, now())` (idempotente: reintentar no reescribe la evidencia).
- Revoke `public, anon`; grant `authenticated`.

> El resto de transiciones (`PICKED_UP → ON_THE_WAY`) siguen por el `UPDATE` directo actual.

### 1.5 — Criterios de aceptación de la Fase 1

- [ ] `select count(*) from deliveries where payment_method is not null and payment_timing is null` = 0.
- [ ] `select_delivery_payment(o,'YAPE',null,'ON_DELIVERY')` → `ASSIGNED`, sin `payment_voucher_path`, `payment_timing='ON_DELIVERY'`.
- [ ] Con `'YAPE'+'ON_DELIVERY'` **y** ruta de comprobante → `22000`.
- [ ] `'CASH'+'UPFRONT'` → `22000` (y un `UPDATE` manual que lo fuerce → `23514`).
- [ ] Llamada legacy `('YAPE', ruta)` y `('CASH', null)` sin 4.º argumento sigue funcionando y deja el timing derivado.
- [ ] `allows_pay_on_delivery=false` + ON_DELIVERY → `22000`; UPFRONT sigue permitido.
- [ ] `complete_delivery` ON_DELIVERY sin declarar cobro → `22000`; con `p_collected_method='YAPE'` → `DELIVERED`, `collected_method='YAPE'`, `cash_collected_at` **nulo**; con el flag legacy `true` → `CASH` y `cash_collected_at` poblado.
- [ ] UPFRONT ignora los flags.
- [ ] `pickup_delivery` con `true` escribe `restaurant_paid_at` una sola vez (segundo llamado no cambia la fecha); con `false` no toca la columna.
- [ ] Repartidor ajeno → `42501`; `anon` → `42501`; pedido no `ASSIGNED` → `22000`.
- [ ] `db push --dry-run` limpio; `types/database.ts` actualizado en el mismo commit.

---

## Fase 2 — Backend

### 2.1 — Constantes (un solo lugar para el copy y los montos)

`lib/constants/payment-method.ts` (extender, no reemplazar):

```ts
export const PAYMENT_TIMINGS = ['UPFRONT', 'ON_DELIVERY'] as const
export type PaymentTiming = (typeof PAYMENT_TIMINGS)[number]

/** Lo que el cliente le paga al repartidor: comida + envío (D1). */
export function amountDueToCourier(total: number, fee: number | null | undefined) {
  return Number(total) + Number(fee ?? 0)
}
export const cashAmountDue = amountDueToCourier // alias temporal; se elimina en la Fase 12

export const PAYMENT_TIMING_COPY = {
  UPFRONT:     { title: 'Pagar ahora',    subtitle: 'Por Yape, con comprobante. Tu repartidor compra con tu dinero.' },
  ON_DELIVERY: { title: 'Pagar al recibir', subtitle: 'Cuando te entreguen el pedido (efectivo o Yape).' },
} as const

export const ON_DELIVERY_METHOD_COPY = {
  CASH: { title: 'Efectivo', subtitle: 'Entrega el monto exacto si puedes.' },
  YAPE: { title: 'Yape',     subtitle: 'Escaneas el QR de tu repartidor al recibir.' },
} as const

/** Etiqueta compuesta para chips y resúmenes. */
export function paymentLabel(method: PaymentMethod | null, timing: PaymentTiming | null) { … }
// 'YAPE'+'UPFRONT' → 'Yape (pagado)'; 'YAPE'+'ON_DELIVERY' → 'Yape al recibir'; 'CASH'+… → 'Efectivo al recibir'
```

`toPaymentTiming(value)` con el mismo criterio defensivo que `toPaymentMethod` (valor raro → `null`, la UI cae al estado neutro).

### 2.2 — Validación (Zod)

`lib/validations/payment-method.ts`:

```ts
export const paymentSelectionSchema = z
  .object({ method: paymentMethodSchema, timing: z.enum(PAYMENT_TIMINGS, 'Elige cuándo quieres pagar') })
  .refine((v) => !(v.method === 'CASH' && v.timing === 'UPFRONT'),
          { message: 'El efectivo solo se paga al recibir' })
```

### 2.3 — Server Actions

- `confirmDeliveryPayment(orderId, { method, timing })`: valida con `paymentSelectionSchema`; llama `select_delivery_payment` con `p_voucher_path` **solo si** `method==='YAPE' && timing==='UPFRONT'`; `revalidatePath` como hoy.
- `advanceOrderStatus(orderId, current, opts)`:
  - `ASSIGNED → PICKED_UP`: `pickup_delivery(orderId, opts.restaurantPaid === true)`.
  - `ON_THE_WAY → DELIVERED`: `complete_delivery(orderId, opts.collected === true, opts.collectedMethod)`.
  - `opts.cashCollected` queda como alias deprecado de `collected` (compatibilidad con llamadores existentes).

### 2.4 — API v1 (paridad; `userClient(request)`, nunca `adminClient()`)

- `PUT /api/v1/orders/[id]` `confirm_payment`: acepta `{ method?, timing? }`. **Sin cuerpo = `YAPE`/`UPFRONT`** (mismo default de hoy).
- `PUT /api/v1/deliveries/[orderId]/advance` (rol `DELIVERY`): `ASSIGNED` acepta `{ restaurant_paid }`; `ON_THE_WAY` acepta `{ cash_collected?, collected_method? }`. El override de `ADMIN` conserva su camino sin exigir cobro (y no inventa un cobro: `collected_at` queda nulo, ya cubierto por la suite).
- `rpcErrorResponse` ya mapea los `errcode`: sin cambios.

### 2.5 — Tipos

`types/database.ts` (columnas + `Functions`: `select_delivery_payment` con `p_timing`, `complete_delivery` con `p_collected_method`, `pickup_delivery`), `types/order.ts` (`payment_timing`, `restaurant_paid_at`, `deliveries.collected_at/collected_method/allows_pay_on_delivery`).

### 2.6 — Criterios de aceptación

- [ ] `pnpm typecheck` limpio; `grep` no encuentra llamadas a la firma vieja de `confirmDeliveryPayment(orderId, method)`.
- [ ] La API sin cuerpo sigue confirmando por Yape adelantado.
- [ ] Un `CASH+UPFRONT` se rechaza en Zod (mensaje en español) antes de salir a la red.

---

## Fase 3 — UI del Repartidor: detalle de entrega, QR grande y cobro verificado

**Objetivo UX:** en la puerta del cliente el repartidor tiene una mano ocupada y poca paciencia. La pantalla debe darle *el monto, el QR y una confirmación de 1–2 toques*. Una acción primaria por estado.

### 3.1 — Datos que necesita `app/repartidor/pedidos/[id]/page.tsx`

- Agregar al `select` de `deliveries(...)`: `payment_timing, collected_at, collected_method`.
- Agregar `orders.payment_timing, restaurant_paid_at`.
- **El QR y el teléfono del propio repartidor** (`profiles.yape_qr_url`, `phone`, `full_name`) por su cliente autenticado (`profiles_select_own` ya lo permite). No hace falta RPC: es su propia fila.

### 3.2 — Bloque "Cobro al entregar" (reemplaza al bloque actual de efectivo)

Se muestra cuando `payment_timing === 'ON_DELIVERY'`. Estados:

```
┌──────────────────────────────────────────────┐
│ COBRO AL ENTREGAR                              │
│ S/ 27.50                       ← text-3xl bold │
│ Comida S/ 20.00 + Envío S/ 7.50                │
│ El cliente indicó: Yape                        │
│ ┌────────────────────────────────────────────┐│
│ │ [ Mostrar mi QR ]        ← solo si dijo Yape ││
│ └────────────────────────────────────────────┘│
│ Yape: 987 654 321  [copiar]                    │
│ Cobra antes de entregar. Si algo falla, usa    │
│ "No pude cobrar".                              │
└──────────────────────────────────────────────┘
```

- **Monto grande y tabular** (es el dato que se mira en la puerta). Desglose "comida + envío" para evitar disputas.
- **"El cliente indicó: Yape/Efectivo"** es información, **no una obligación** (D4).
- **"Mostrar mi QR"** abre un `Dialog` **a pantalla casi completa** (`max-h-[calc(100dvh-2rem)]`): QR `object-contain` de ~288–320 px, monto, nombre del repartidor y "Escanéalo y transfiere S/ X". Fondo blanco fijo (el QR debe escanearse también en modo oscuro), sin animaciones.
- Si **el repartidor no cargó QR**: el bloque muestra el número con `CopyButton` y un aviso accionable *"Sube tu QR en tu perfil para cobrar más rápido"* con enlace a `/repartidor/perfil` (no bloquea el cobro).
- Si **no tiene ni QR ni teléfono** (cuenta incompleta): solo el aviso; el cobro por Yape queda a su criterio y se registra igual.
- Tras cobrar: el bloque pasa a "**Cobrado el {fecha} · {Yape|Efectivo}**" (mismo lugar, mismo dato, otro momento).

Con `UPFRONT` se conserva el bloque de **comprobante** actual (con el monto al lado, ahora `comida + envío` por D1).

### 3.3 — Diálogo "¿Cómo te pagó?" (reemplaza al `ConfirmDialog` de efectivo en `AdvanceStatusButton`)

Se abre al pulsar **"Marcar entregado"** cuando `payment_timing === 'ON_DELIVERY'` (para cualquier método). Componente nuevo `CollectPaymentDialog`:

1. **Selector segmentado** *(radios nativos, mismo patrón que `PaymentMethodChoice`)*: `Yape` / `Efectivo`. **Preseleccionado con lo que el cliente anunció** (aquí sí es aceptable: el repartidor está confirmando un hecho, no tomando una decisión con dinero ajeno; y siempre puede cambiarlo).
2. **Atestación obligatoria** (checkbox propio del método; el botón queda deshabilitado hasta marcarlo y lo explica):
   - Yape: *"Ya vi el yapeo de **S/ 27.50** en mi app de Yape."*
   - Efectivo: *"Ya recibí **S/ 27.50** en efectivo."*
3. **CTA primario:** "Confirmar cobro y entregar". **Secundario (texto, no lleno):** "No pude cobrar" → Fase 8.
4. Aviso honesto de una línea: *"PideloYa no puede verificar el yapeo: confirma en tu app antes de entregar."* (no prometer más de lo que se hace).
5. Al confirmar → `advanceOrderStatus(orderId, 'ON_THE_WAY', { collected: true, collectedMethod })`.

**Por qué checkbox y no solo un botón:** un toque accidental en la puerta no debe cerrar la entrega; la atestación es también la constancia de que *él* declaró haber cobrado (base de cualquier disputa posterior).

**Por qué no bloquear si difiere de lo anunciado:** ver D4. Se registra `collected_method` real; el admin puede auditar diferencias.

### 3.4 — Lista "Mis entregas" (`DeliveryOrdersClient`)

| Estado | Pie de tarjeta |
|---|---|
| `ON_DELIVERY` sin cobrar | Chip ámbar **"Cobrar S/ X al entregar (Yape o efectivo)"** (con Yape anunciado: "…· pagará con Yape") |
| `ON_DELIVERY` cobrado | Chip verde texto **"Cobrado · Yape/Efectivo"** |
| `UPFRONT` | "Comprobante adjunto" (como hoy) |
| `AWAITING_PAYMENT` | sin cambios (retirar oferta) |

### 3.5 — Criterios de aceptación

- [ ] Con Yape al recibir, el repartidor ve monto, desglose y "Mostrar mi QR" en el **detalle** y el chip en la **lista**.
- [ ] No puede marcar entregado un ON_DELIVERY sin marcar la atestación ni por UI ni por API (la guarda real es SQL).
- [ ] Si el cliente anunció Yape y el repartidor cobra en efectivo, `collected_method='CASH'` y `payment_method='YAPE'` conviven sin error.
- [ ] Sin QR cargado: el bloque degrada (número + aviso) sin elementos rotos.
- [ ] El QR ampliado se lee en modo oscuro (fondo blanco fijo).
- [ ] UPFRONT y legacy: flujo idéntico al actual, sin diálogo extra.

---

## Fase 4 — UI del Cliente: "Pagar al recibir" → ¿Con qué?

### 4.1 — Estructura (revelado progresivo, sin preselección)

```
¿Cómo quieres pagar?                       ← legend
┌──────────────────────────────────────────┐
│ ( ) Pagar ahora                            │
│     Por Yape, con comprobante…             │
└──────────────────────────────────────────┘
┌──────────────────────────────────────────┐
│ (•) Pagar al recibir                       │
│     Cuando te entreguen el pedido          │
│   ┌ ¿Con qué pagarás? ───────────────────┐│   ← aparece SOLO al elegir "al recibir"
│   │ ( ) Efectivo                          ││
│   │ ( ) Yape                              ││
│   └───────────────────────────────────────┘│
└──────────────────────────────────────────┘
Elige una opción para continuar             ← ayuda mientras falte algo
```

- **Dos `fieldset`/`legend` anidados** con radios nativos (flechas de teclado, agrupación, lector de pantalla). El sub-grupo va **dentro** de la tarjeta "Pagar al recibir" y se monta al seleccionarla (no `display:none` permanente: evita foco en controles invisibles).
- **Sin preselección en ningún nivel** (D3). El CTA aparece solo cuando la tupla está completa.
- Si `allows_pay_on_delivery=false` (D7): "Pagar al recibir" se muestra **deshabilitada** con la razón visible *"Este repartidor solo acepta pago por adelantado"* (no se oculta: ocultar sin explicar parece un bug). `get_delivery_offer_details` no cambia (evita el `DROP`+`CREATE` que rompería el código desplegado); el flag viaja por `orders`/`deliveries` desde una lectura adicional en la página.
- Estado en el padre (`DeliveryPaymentCard`): `timing`, `method` (derivado del sub-grupo), `file` (se conserva al alternar, como hoy), `phase`. `busy` se **deriva** de `phase`. Cambiar el "cuándo" limpia el "con qué" salvo que siga siendo válido.
- Componentes definidos a **nivel de módulo**, nunca dentro de otro (regla ya aplicada en el proyecto).

### 4.2 — Paneles según la tupla

| Tupla | Panel | CTA |
|---|---|---|
| `UPFRONT + YAPE` | `YapePaymentPanel` (QR, número, comprobante). **Monto ahora `comida + envío` (D1).** | "Ya pagué, confirmar" |
| `ON_DELIVERY + CASH` | `CashPaymentPanel` (sin cambios de estructura) | "Confirmar pago en efectivo" |
| `ON_DELIVERY + YAPE` | **`YapeOnDeliveryPanel` (nuevo)** | "Confirmar: pagaré por Yape al recibir" |

**`YapeOnDeliveryPanel`:** monto grande *"Le pagarás a {nombre}"* **S/ X**, subtítulo *"Comida + envío. Yapeas cuando te entregue el pedido."*; vista previa pequeña del QR del repartidor (tocable para ampliar, ya existe el patrón) y número con `CopyButton`; **sin picker de comprobante** (D5). Aviso `PAYMENT_METHOD_LOCK_NOTICE` antes del clic. Sin diálogo de confirmación extra (la decisión ya está anunciada).

> Mostrar el QR desde ahora tiene un beneficio real: el cliente puede **preparar** su Yape (guardar el contacto, ver que tiene saldo) antes de que llegue el repartidor.

### 4.3 — Reglas anti-deformación (heredadas)

`w-full min-w-0` en cada tarjeta; sin alturas fijas; el sub-grupo entra sin saltos (misma altura reservada por el esqueleto del `dynamic` cuando aplique); texto largo con `break-words`.

### 4.4 — Unificación del monto (D1) — cambios exactos de copy

- `YapePaymentPanel`: diálogo del QR *"Escanéalo y transfiere S/ {fee}"* → `S/ {comida+envío}`; prop `fee` → `amount`.
- `OrderSummaryCard`: la nota bajo el total pasa a depender de `(method, timing)`:
  - `YAPE+UPFRONT`: *"Pagaste S/ X por Yape a tu repartidor: comida + envío."*
  - `YAPE+ON_DELIVERY`: *"Pagas S/ X por Yape a tu repartidor al recibir tu pedido: comida + envío."*
  - `CASH+ON_DELIVERY`: (la de hoy)
  - Chip de la fila "Envío": `paymentLabel(method, timing)`.
- `DeliveryPaymentCard`: subtítulo del encabezado "Costo de envío S/ fee" se mantiene (es la tarifa del repartidor) y **se agrega** una línea "Total a pagar al repartidor: S/ X".

### 4.5 — Después de elegir (estado `ASSIGNED…ON_THE_WAY`)

`OrderStatusSection` amplía el recordatorio que hoy existe solo para CASH: para cualquier `ON_DELIVERY` muestra *"Recuerda: pagas S/ X {en efectivo | por Yape} a tu repartidor cuando te entregue el pedido"*; con Yape agrega un botón **"Ver QR de mi repartidor"** (usa `yape_qr_url`/`phone` que `get_delivery_offer_details` ya devuelve en estados vivos; **no requiere RPC nueva**).

### 4.6 — Criterios de aceptación

- [ ] "Pagar al recibir" revela "¿Con qué pagarás?" sin preselección; el CTA no aparece hasta completar.
- [ ] Yape al recibir: pedido `ASSIGNED`, `payment_timing='ON_DELIVERY'`, sin `payment_voucher_path`.
- [ ] Alternar niveles conserva el archivo del comprobante.
- [ ] Ningún texto de un pedido ON_DELIVERY dice "pagaste" ni "envío por Yape" (auditar con `grep` los textos condicionados por método).
- [ ] Repartidor con `allows_pay_on_delivery=false`: opción deshabilitada con motivo.
- [ ] Teclado: Tab llega a cada grupo, flechas cambian de opción, el foco se ve (lima global) también sobre los radios `sr-only`.
- [ ] Bundle inicial no incluye `compress-voucher` ni el picker hasta elegir *Pagar ahora* (verificar chunks).

---

## Fase 5 — Repartidor: compra en el restaurante ("Pagué al restaurante")

**Es la respuesta directa a la observación de la revisión:** convierte "el repartidor paga la comida al restaurante" de algo invisible en algo **declarado, fechado y visible**.

### 5.1 — Diálogo al pasar `ASSIGNED → PICKED_UP`

`PickupDialog` (mismo `ConfirmDialog` del proyecto, `variant="default"`):

- Título: **"¿Pagaste el pedido en {restaurante}?"**
- Cuerpo según timing:
  - `ON_DELIVERY`: *"Estás adelantando **S/ {comida}** de tu dinero. El cliente te lo devolverá al entregar (S/ {total} en total)."* → refuerzo honesto del riesgo que asume.
  - `UPFRONT`: *"Usa el dinero que el cliente ya te transfirió. Paga **S/ {comida}** al restaurante."*
- Botón: **"Sí, pagué y recogí"** → `advanceOrderStatus(id,'ASSIGNED',{ restaurantPaid:true })`.
- Enlace secundario (sin llenar): **"Recoger sin pagar (ya estaba pagado)"** → `restaurantPaid:false` para los casos raros (cortesía, restaurante que factura aparte). **No se bloquea**: forzar `true` empujaría a marcar falso.

### 5.2 — Información previa al aceptar el trabajo

En **Disponibles** (`AvailableOrdersClient`/`DeliveryOrderCard`) mostrar la comida como línea propia: *"Comida: S/ 20.00 · si te pagan al recibir, la adelantas tú"*. Cambio de copy, cero backend: el repartidor decide **con el dato del adelanto a la vista** (Fase 7 lo complementa con el toggle).

### 5.3 — Criterios de aceptación

- [ ] `orders.restaurant_paid_at` queda poblado al confirmar "Sí, pagué"; reintentar no cambia la fecha.
- [ ] "Recoger sin pagar" avanza el pedido y deja `restaurant_paid_at` nulo.
- [ ] El diálogo muestra el monto del adelanto solo en `ON_DELIVERY`.
- [ ] La lista de Disponibles muestra la comida como dato independiente del envío.

---

## Fase 6 — Restaurante: visibilidad del pago

**Objetivo:** que el restaurante sepa que **va a cobrar y quién le paga**, sin darle un botón que no necesita todavía.

- `app/restaurante/pedidos/page.tsx` agrega `restaurant_paid_at, payment_method, payment_timing` al `select` (columnas de `orders`, ya legibles por la policy actual).
- `RestaurantOrdersTable`: columna **"Pago"** con texto (no solo color):
  - `restaurant_paid_at` presente → **"Pagado por el repartidor · 14:32"**
  - pedido en `PICKED_UP+` sin fecha → **"Pago pendiente de confirmar"** (ámbar)
  - `ASSIGNED` → "El repartidor pagará al recoger"
  - `DELIVERED` sin fecha → "Sin registro de pago" (para conciliar en Fase 8)
- `OrderDetailsDialog`: fila "Cobro de la comida" con la misma lógica.
- Texto explicativo **una sola vez** en el encabezado de la página: *"El repartidor te paga la comida al recoger el pedido. Aquí ves cuándo lo registró."*
- **No** se expone el método/timing del cliente ni datos del repartidor al restaurante (mínimo privilegio): solo *si y cuándo se le pagó*.
- *(Opcional, ver Fase 8)* botón **"Reportar problema con el pago"**.

Criterios: el restaurante ve la constancia en su lista y detalle; ningún dato personal del cliente/repartidor nuevo; sin cambios en dashboards de ventas.

---

## Fase 7 — Protección del repartidor (D7)

El repartidor es quien pone plata. Sin controles, el sistema traslada el riesgo a un usuario que no lo eligió.

1. **Migración `20261002100400_profiles_accepts_pay_on_delivery.sql`:** `profiles.accepts_pay_on_delivery boolean not null default true`. (Default `true` = comportamiento actual, ya que el efectivo hoy existe. Sin backfill.)
2. **`offer_delivery`:** copia el flag a `deliveries.allows_pay_on_delivery` (snapshot: si el repartidor lo cambia después, la oferta ya enviada **no** cambia — el cliente no puede ver una promesa que se retira mientras decide). Reemplazo con `create or replace` (misma firma).
3. **`/repartidor/perfil`:** interruptor en la tarjeta "Cobros" — *"Acepto que el cliente pague al recibir. Adelanto la comida de mi dinero."* con texto de ayuda de qué implica. Se guarda con el botón "Guardar cambios" (patrón de borrador existente) o inmediato con toast (`BusinessStatusSwitch` como referencia). Acción: `setAcceptsPayOnDelivery(boolean)` con Zod; `revalidatePath('/repartidor/perfil')`.
4. **Formulario de oferta (`SendOfferForm`):** línea informativa según el toggle: *"Aceptas pago al recibir (adelantas S/ X de comida)"* / *"Solo cobras por adelantado"*.
5. **Riesgo residual documentado, no resuelto por código:** el repartidor sigue expuesto al cliente que no paga. Mitigaciones futuras (no en este plan): límite de adelanto por repartidor, reputación del cliente, bloqueo tras incidencias (§11).

Criterios: con el toggle apagado, el cliente ve "Pagar al recibir" deshabilitado con motivo (Fase 4) y `select_delivery_payment` lo rechaza aunque se fuerce por API; con el toggle encendido, comportamiento actual; la oferta ya enviada conserva su snapshot.

---

## Fase 8 — Incidencias ("No pude cobrar") y conciliación

### 8.1 — Modelo

`20261002100500_payment_incidents.sql`:

```sql
create table public.payment_incidents (
  id            uuid primary key default gen_random_uuid(),
  order_id      uuid not null references public.orders(id) on delete cascade,
  reported_by   uuid references public.profiles(id) on delete set null,
  reporter_role public.user_role not null,
  kind          text not null check (kind in ('CUSTOMER_DID_NOT_PAY','RESTAURANT_NOT_PAID','AMOUNT_MISMATCH','OTHER')),
  note          text check (char_length(note) <= 500),
  created_at    timestamptz not null default now(),
  resolved_at   timestamptz,
  resolved_by   uuid references public.profiles(id) on delete set null
);
create index payment_incidents_open_idx on public.payment_incidents(created_at desc) where resolved_at is null;
alter table public.payment_incidents enable row level security;
-- lectura: ADMIN todo; reporter sus propias filas. Escritura: solo vía función (security definer).
```

`report_payment_incident(p_order_id, p_kind, p_note)` valida que el llamador sea **parte del pedido** (el repartidor asignado, el restaurante del pedido, o el cliente dueño) y que `kind` corresponda al rol (repartidor: `CUSTOMER_DID_NOT_PAY`/`AMOUNT_MISMATCH`; restaurante: `RESTAURANT_NOT_PAID`). Idempotente por (pedido, tipo, reportante, abierta).

### 8.2 — "No pude cobrar" (D8)

En `CollectPaymentDialog` (Fase 3.3), enlace secundario abre un diálogo corto: *"¿Qué pasó?"* — *"El cliente no está / no paga"* · *"El monto no coincide"* · *"Otro"* + nota opcional. Efectos:
- Crea la incidencia; **el pedido NO pasa a `DELIVERED`** y se queda `ON_THE_WAY` (el repartidor no queda "atrapado": puede reintentar el cobro o esperar a soporte).
- Toast: *"Registramos tu reporte. Soporte lo revisará."* — sin prometer plazos ni resultados que no controlamos.
- Aparece en admin (8.3) y, opcionalmente, notifica por el canal realtime existente.

### 8.3 — Admin: conciliación

`/admin/pagos` (o pestaña en `/admin/pedidos`), Server Component con `AdminTableShell`/`TablePagination` como el resto:

- Filtros: *Incidencias abiertas · Entregados sin constancia de pago al restaurante · Cobro distinto a lo anunciado (`collected_method <> payment_method`) · ON_DELIVERY sin `collected_at` con pedido `DELIVERED` (debería ser imposible: alerta de integridad)*.
- Acciones: **resolver** incidencia (nota interna) y registrada en `admin_audit_log` (`AUDIT_ACTIONS.resolvePaymentIncident`). Sin mover dinero: es un registro de gestión.
- Export CSV reutilizando `query-builders` (`entity=payments`), con la misma nota de PII que las otras exportaciones.
- Badge en el sidebar con incidencias abiertas (patrón de `fetchPendingApprovalCounts`).

### 8.4 — Restaurante

Botón "Reportar problema con el pago" en el detalle del pedido → `RESTAURANT_NOT_PAID`. Sin lógica adicional: entra a la misma bandeja del admin.

Criterios: una incidencia no cambia el estado del pedido; solo las partes del pedido y el admin la leen; resolver deja rastro en auditoría; tabla vacía → `EmptyState` estándar.

---

## Fase 9 — Privacidad, Términos y aspectos tributarios

**Privacidad (`app/(public)/privacidad/page.tsx`):** en "Datos que recopilamos": *método y momento de pago elegidos, cobro declarado por el repartidor, constancia de pago al restaurante e incidencias de pago reportadas*. Finalidad: conciliación y resolución de disputas. Conservación: forman parte del **registro de la transacción** (5 años, como el resto; no son PII y sobreviven a la anonimización). Subir `UPDATED_AT`.

**Términos (`app/(public)/terminos/page.tsx`)** — hoy la sección 5 habla de precios y cancelaciones pero **no describe el flujo de pago con el repartidor**. Agregar, con revisión legal:
- El pago del pedido y del envío se hace **al repartidor** (por Yape o efectivo, ahora o al recibir); PideloYa **no procesa ni custodia** pagos.
- El repartidor puede adelantar el importe de la comida al restaurante; el cliente se obliga a pagar el total al recibir cuando eligió esa modalidad.
- Consecuencias de no pagar (suspensión de cuenta) y canal de reclamos.
- Que el comprobante/atestación es evidencia, no verificación bancaria.

**Tributario (D10) — validar con el contador antes de producción:** ¿quién emite la boleta/factura al cliente (restaurante o repartidor)? ¿el repartidor actúa como comprador o como mandatario? ¿el envío tributa aparte? El sistema ya separa `orders.total` (comida) de `delivery_fee` (envío), lo que facilita cualquier respuesta, pero **no la decide**.

---

## Fase 10 — Accesibilidad, motion y responsive (no negociable)

1. **Contraste medido, no estimado** (como en el ciclo anterior): chip "Cobrar…", chip "Cobrado", textos `text-xs` de las atestaciones, monto `text-3xl` del repartidor, bordes de radios nuevos (≥ 3:1, componentes de UI) — repetir la medición con los tokens reales para claro y oscuro.
2. **No depender del color:** método y estado del cobro siempre como **texto** (chip), nunca solo punto de color.
3. **Foco visible** en radios `sr-only` (`peer-focus-visible:outline`), checkbox de atestación y diálogos; ningún `outline-none` sin reemplazo. `scroll-padding-top` global ya evita foco tapado por el header.
4. **Objetivo táctil ≥ 40 px** (opciones `min-h-14`, CTA `h-11`, segmentado del diálogo `min-h-12`). En la puerta, botones grandes: es una pantalla de uso con una mano.
5. **Lector de pantalla:** `fieldset/legend` en ambos niveles; diálogos con `DialogTitle`; errores `role="alert"`; el cambio de estado del cobro se anuncia (`aria-live="polite"`).
6. **`prefers-reduced-motion`:** sin animaciones nuevas.
7. **Responsive 360/428/768/1280:** una sola columna; QR ampliado `max-w-full`; el diálogo del cobro no queda tapado por el teclado (no hay campos de texto salvo la nota de incidencia, que va en un diálogo aparte con scroll interno).
8. **Sin CLS:** esqueleto reservado para paneles cargados con `dynamic`.

---

## Fase 11 — QA

### 11.1 — Suite E2E (`scripts/e2e-delivery-offer.mjs`, local)

Casos nuevos sobre los 64 existentes (que deben seguir en verde — regresión principal):

**Selección de pago**
- `YAPE+ON_DELIVERY` sin voucher → `ASSIGNED`, `payment_timing='ON_DELIVERY'`, `payment_voucher_path` nulo, `payment_confirmed_at` poblado, `collected_at` nulo.
- `YAPE+ON_DELIVERY` **con** ruta → 400; `CASH+UPFRONT` → 400 (API) / `23514` (UPDATE manual).
- Legacy sin `timing`: `('YAPE', ruta)` → UPFRONT; `('CASH')` → ON_DELIVERY (compatibilidad).
- `allows_pay_on_delivery=false` + ON_DELIVERY → 400; + UPFRONT → OK; snapshot inmutable si el repartidor cambia el perfil después.
- Doble elección mezclada (CASH luego YAPE/ON_DELIVERY) → 409; cliente ajeno → 403; anon → `42501`.

**Cobro**
- ON_DELIVERY sin atestación → 400 y el pedido **sigue** `ON_THE_WAY`.
- `collected_method='YAPE'` → `DELIVERED`, `collected_at` poblado, `cash_collected_at` nulo.
- Cliente anunció YAPE, repartidor declara CASH → OK; `payment_method='YAPE'`, `collected_method='CASH'`, `cash_collected_at` poblado.
- `collected_method='PLIN'` → 400. UPFRONT ignora flags. Repartidor ajeno → 403/`42501`. Pedido ya entregado → 400.
- Override ADMIN cierra ON_DELIVERY sin exigir cobro y **no** inventa `collected_at`.
- CHECKs: `collected_at` en un UPFRONT → `23514`; `payment_voucher_path` en `YAPE+ON_DELIVERY` → `23514`.

**Compra en restaurante**
- `pickup_delivery(true)` escribe `restaurant_paid_at`; segundo llamado no lo cambia; `false` no lo toca; repartidor ajeno → `42501`; pedido no `ASSIGNED` → 400.

**Incidencias**
- Repartidor crea `CUSTOMER_DID_NOT_PAY` → fila creada, pedido sigue `ON_THE_WAY`; duplicado abierto → idempotente; kind no permitido para el rol → 403; ajeno al pedido → 403; admin resuelve → auditoría escrita.

**Regresión de ciclos previos:** cancelar/retirar/expirar oferta sigue sin dejar método ni voucher; anonimización borra vouchers y no toca método/timing/collected.

### 11.2 — Checklist manual (pantalla y dos sesiones)

- [ ] Cliente: Pagar al recibir → revela ¿Con qué? → Yape → confirma; luego ve recordatorio con QR del repartidor.
- [ ] Repartidor: ve chip "Cobrar S/ X", "Mostrar mi QR" a pantalla grande (probar en celular real, brillo bajo y modo oscuro), copiar número.
- [ ] Cobro Yape: atestación obligatoria; entrega cierra; "Cobrado · Yape".
- [ ] Cobro con método distinto al anunciado.
- [ ] "No pude cobrar" → incidencia visible en admin; el pedido no se entrega.
- [ ] Recoger: "Sí, pagué" → restaurante ve "Pagado por el repartidor · hora" **sin recargar** (realtime existente).
- [ ] Repartidor sin QR / sin teléfono: degradación sin roturas.
- [ ] Toggle "Acepto pago al recibir" apagado → cliente ve la opción deshabilitada con motivo.
- [ ] Pedido legacy (`payment_timing` nulo): sin chip ni errores.
- [ ] Textos de monto coherentes en cliente, repartidor, restaurante (mismo `S/ X` en los tres).
- [ ] Teclado y lector de pantalla en ambos niveles de selección; `prefers-reduced-motion`; 360 px.
- [ ] Admin/restaurante: dashboards de ventas sin cambios.
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm build` en verde.

---

## Fase 12 — Despliegue, *contract* y rollback

### 12.1 — Orden

| # | Paso | Por qué |
|---|---|---|
| 1 | Migraciones 1.1 → 1.4 (`db push`) | Solo agregan; **`select_delivery_payment` y `complete_delivery` mantienen compatibilidad** con la app desplegada (defaults y derivación de `timing`). |
| 2 | `types/database.ts` en el mismo commit | Tipos = base aplicada. |
| 3 | **Fases 3 y 5 (UI repartidor) + Fase 2** | Retrocompatible: no muestra nada nuevo hasta que existan elecciones nuevas. |
| 4 | Fase 7 (toggle) | Sin efecto mientras todos tengan `true`. |
| 5 | **Fase 4 (UI cliente)** | Recién ahora el cliente puede elegir "Yape al recibir": el repartidor ya sabe cobrarlo. |
| 6 | Fases 6, 8, 9 | Visibilidad, incidencias y textos legales (los Términos deben salir **antes** o con la Fase 4). |
| 7 | QA (Fase 11) con dos sesiones y celular real | Verificación de extremo a extremo. |
| 8 | **Migración *contract*** `…_drop_legacy_payment_columns.sql` | Recién con la app nueva desplegada y estable: `drop constraint deliveries_cash_collected_requires_cash_check`, `drop column cash_collected_at`, retirar el alias `cashAmountDue` y el flag legado `p_cash_collected`. **No dejar este archivo en `supabase/migrations/` antes del despliegue**: el próximo `db push` lo aplicaría y rompería la app desplegada (mismo criterio ya aplicado en ciclos anteriores). |
| 9 | *(Opcional)* endurecer `orders_update_delivery_assigned` (quitar `DELIVERED` y `PICKED_UP` del `with check`) | Deja `complete_delivery`/`pickup_delivery` como únicas puertas. |

### 12.2 — Rollback

- Código: revert seguro en cualquier punto tras el paso 1 (columnas/funciones nuevas quedan sin uso; las firmas viejas siguen resolviendo).
- **No** hacer `drop column payment_timing/collected_*/restaurant_paid_at` si ya hay pedidos: se perdería quién cobró qué y la constancia al restaurante.
- Si se revierte tras el paso 8, recrear `cash_collected_at` con un script de rollback incluido en comentarios de esa migración (verbatim, como en la migración de cierre anterior).

---

## Riesgos y mitigaciones

| Riesgo | Prob. | Impacto | Mitigación en el plan |
|---|---|---|---|
| Cliente no paga al recibir tras adelantar el repartidor | Media | Alto (pérdida del repartidor) | Toggle (F7), aviso de adelanto (F5), "No pude cobrar" (F8); **futuro:** límite de adelanto y reputación |
| Repartidor marca "cobré" sin cobrar | Baja-Media | Medio | Atestación explícita, `collected_method` auditable, conciliación admin (F8) |
| Repartidor marca "pagué al restaurante" sin pagar | Baja | Medio | Visibilidad al restaurante + "Reportar problema" (F6/F8) |
| Confusión de montos (envío vs. total) | Alta si no se unifica | Alto | D1 + copy único en `amountDueToCourier` y auditoría con `grep` |
| Cliente cambia de opinión tras elegir | Media | Bajo | Aviso antes del clic (definitivo) |
| App desplegada rompe entre `db push` y deploy | Media | Alto | Firmas compatibles + derivación de `timing` (F1.2/F1.3) |
| Cuestión tributaria no resuelta | Media | Alto (legal) | D10 + F9: validar con contador antes de producción |

---

## Resumen de archivos

### Nuevos
- `supabase/migrations/20261002100000_payment_timing_and_collection.sql`
- `supabase/migrations/20261002100100_select_delivery_payment_v2.sql`
- `supabase/migrations/20261002100200_complete_delivery_v2.sql`
- `supabase/migrations/20261002100300_pickup_delivery.sql`
- `supabase/migrations/20261002100400_profiles_accepts_pay_on_delivery.sql`
- `supabase/migrations/20261002100500_payment_incidents.sql`
- `components/features/orders/YapeOnDeliveryPanel.tsx`
- `components/features/deliveries/CollectPaymentDialog.tsx`
- `components/features/deliveries/PickupDialog.tsx`
- `components/features/deliveries/CourierQrDialog.tsx`
- `components/features/deliveries/ReportPaymentIncidentDialog.tsx`
- `app/admin/pagos/page.tsx` (+ tabla y filtros)
- `lib/actions/payment-incidents.ts`

### Modificados
- `lib/constants/payment-method.ts`, `lib/validations/payment-method.ts`
- `lib/actions/orders.ts`, `lib/actions/deliveries.ts`, `lib/actions/profile.ts`
- `app/api/v1/orders/[id]/route.ts`, `app/api/v1/deliveries/[orderId]/advance/route.ts`
- `components/features/orders/PaymentMethodChoice.tsx`, `DeliveryPaymentCard.tsx`, `YapePaymentPanel.tsx`, `OrderSummaryCard.tsx`, `OrderStatusSection.tsx`
- `app/cliente/pedidos/[id]/page.tsx`
- `app/repartidor/pedidos/[id]/page.tsx`, `components/features/deliveries/AdvanceStatusButton.tsx`, `DeliveryOrdersClient.tsx`, `AvailableOrdersClient.tsx`, `DeliveryOrderCard.tsx`, `SendOfferForm.tsx`
- `app/repartidor/perfil/page.tsx` (toggle)
- `app/restaurante/pedidos/page.tsx`, `RestaurantOrdersTable.tsx`, `OrderDetailsDialog.tsx`
- `lib/admin/audit-log.ts`, `lib/admin/query-builders.ts`, `app/api/admin/export/route.ts`, `AdminSidebar`/`app/admin/layout.tsx`
- `types/database.ts`, `types/order.ts`
- `app/(public)/privacidad/page.tsx`, `app/(public)/terminos/page.tsx`
- `docs/decisions-and-learnings.md`, `scripts/e2e-delivery-offer.mjs` *(local)*

---

## 11. Fuera de alcance (documentado a propósito)

- **Verificación automática del yapeo:** requiere integración bancaria/Yape Empresas; hasta entonces todo es *evidencia declarada*. La UI no debe prometer más.
- **Comprobante opcional del cliente tras pagar en la puerta** (captura post-pago para el caso "Yape al recibir"): mejora natural, reutiliza el bucket y `PaymentVoucherPicker`; se pospone para no ampliar la superficie de datos personales sin necesidad probada.
- **Límite de adelanto por repartidor, reputación de cliente y bloqueo tras incidencias:** requieren datos históricos y reglas de negocio propias; conviene decidirlas con las primeras incidencias reales.
- **Liquidación automática repartidor ↔ restaurante:** el modelo actual es que se pagan en mano/Yape al recoger; PideloYa no interviene.
- **Boletas/facturas electrónicas** (D10).
- **Otros medios (Plin, tarjeta):** agregar un valor a los `CHECK` y una entrada en `PAYMENT_*_COPY` (beneficio directo de haber usado `text + CHECK`).
