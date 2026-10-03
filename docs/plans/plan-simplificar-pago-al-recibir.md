# Plan de Implementación — Simplificar el pago del pedido (cliente ↔ repartidor)

**Proyecto:** PideloYa
**Alcance:** `/cliente/pedidos/[id]` · `/repartidor/pedidos/**` · textos legales · admin (conciliación)
**Base:** código real del repo (migraciones hasta `20261002100500`, `select_delivery_payment` v2, `complete_delivery` v2, `PaymentMethodChoice`, `DeliveryPaymentCard`, `CollectPaymentDialog`, `AdvanceStatusButton`).
**Regla del plan:** **cero archivos nuevos salvo 1 migración SQL (inevitable)**. Todo lo demás es editar o **eliminar** archivos que quedan sin uso.

---

## 0. Qué se pide (y qué NO)

| Pedido | Traducción técnica |
|---|---|
| Cliente: "Pagar al recibir" **no pregunta** Yape/Efectivo | La elección pasa de 2 niveles a **1 nivel**: `Pagar ahora` / `Pagar al recibir`. Al recibir ya no se guarda método. |
| Repartidor: en la entrega **solo muestra el QR** | El detalle muestra monto + botón "Mostrar mi QR". Se elimina todo lo demás del bloque de cobro. |
| Repartidor: último paso = **solo "Finalizar"** | Se elimina el diálogo "¿Cómo te pagó?" (selector + checkbox de atestación). Un botón, un toque. |
| Quitar texto y pasos redundantes en todo el flujo | Auditoría de copy (Fase 1) y recorte de cada pantalla (Fases 4–6). |

**Lo que NO cambia:** "Pagar ahora" (Yape + comprobante), la constancia de pago al restaurante (`restaurant_paid_at`), el snapshot D7 (toggle "acepto pago al recibir"), realtime, RLS, ni el flujo de oferta del repartidor.

---

## 1. Diagnóstico: qué es redundante hoy

### 1.1 Pasos de decisión (se repite la misma pregunta 3 veces)

```
Cliente:    ¿Cuándo? (ahora / al recibir) → ¿Con qué? (Efectivo / Yape) → panel → confirmar
Repartidor: ¿Cómo te pagó? (Yape / Efectivo) → checkbox "Ya vi el yapeo…" → "Confirmar cobro y entregar"
```
El método se decide, se anuncia, se vuelve a declarar y se compara (`mismatch` en admin). Nadie lo usa para nada: el repartidor cobra con lo que el cliente le entregue.

### 1.2 Texto repetido (inventario real)

| Dato repetido | Dónde aparece hoy | Se queda en |
|---|---|---|
| "No podrás cambiar el método después de confirmar" | `PaymentMethodChoice`, `CashPaymentPanel`, `YapeOnDeliveryPanel`, `YapePaymentPanel` (4×) | **1 vez**, bajo el botón de la tarjeta |
| Monto total (comida + envío) | Header de la tarjeta, subtítulo de opción, panel, resumen, recordatorio de estado, chip repartidor | Opción "Pagar al recibir" + resumen del pedido |
| "Pagas S/ X al recibir…" | `OrderSummaryCard` (nota) **y** `OrderStatusSection` (recordatorio) | Solo `OrderSummaryCard` |
| QR del repartidor | Panel del cliente, diálogo de estado del cliente, detalle del repartidor | **Solo repartidor** (y en "Pagar ahora" para transferir) |
| "El cliente indicó: Yape/Efectivo" + chip "pagará con Yape" | Detalle y lista del repartidor | Eliminado |
| Número de Yape copiable | Detalle repartidor (fila) + diálogo QR + panel cliente | Solo dentro del diálogo del QR |
| "Comida S/ X · adelantas tú" | `AvailableOrdersClient` **y** `SendOfferForm` | Solo `AvailableOrdersClient` |
| Textos de ayuda "Elige una opción…", "Adjunta tu comprobante para poder confirmar…" | Debajo de cada control | Se mantiene solo el que explica un botón deshabilitado |
| Toasts largos ("Pagarás S/ X en efectivo cuando te lo entregue") | `DeliveryPaymentCard` | Toast de una línea |

### 1.3 Piezas que desaparecen
- `CashPaymentPanel.tsx`, `YapeOnDeliveryPanel.tsx`, `CollectPaymentDialog.tsx` (3 archivos **eliminados**).
- Sub-grupo "¿Con qué pagarás?" en `PaymentMethodChoice`.
- Vista de conciliación `mismatch` en `/admin/pagos` (ya no hay "anunciado vs cobrado").

---

## 2. Decisiones a validar (léelas primero)

| # | Decisión | Por qué | Cómo se cambia |
|---|---|---|---|
| **S1** | "Pagar al recibir" **no guarda `payment_method`** (queda `NULL`); solo `payment_timing='ON_DELIVERY'`. | Guardar un método que nadie elige sería inventar un dato. Con QR del repartidor el cliente puede yapear o dar efectivo en ese momento; el sistema no lo necesita. | Si quieres métricas por medio, se puede capturar después con un solo toggle en "Finalizar" (no recomendado: es justo lo que se quiere quitar). |
| **S2** | "Finalizar" es **un toque, sin diálogo ni checkbox**. | Pedido explícito. La constancia pasa a ser `collected_at` = "el repartidor finalizó la entrega con cobro". | Reponer un confirm de una línea es agregar `ConfirmDialog` (ya existe). |
| **S3** | Se **conserva** "No pude cobrar" como **enlace de texto secundario** (abre `PaymentIncidentDialog`, ya existe). | Es la única salida del repartidor si el cliente no paga; sin ella el incentivo es finalizar "como si" hubiera cobrado. No compite con el botón primario. | Quitarlo = borrar una línea en `AdvanceStatusButton`. |
| **S4** | El **cliente ya no ve el QR del repartidor** en "Pagar al recibir" ni en el estado del pedido. | Pedido: "es suficiente que el repartidor muestre el QR". "Pagar ahora" sí lo necesita (transferir antes) y se queda. | — |
| **S5** | Monto a pagar al recibir sigue siendo **comida + envío** (D1 del plan anterior). | El repartidor adelanta la comida; es lo que debe recibir. | — |
| **S6** | El diálogo de recogida (`PickupDialog`) se **acorta** pero mantiene `restaurant_paid_at`. | Es evidencia para el restaurante; solo se recorta texto. | — |

---

## 3. Diseño UI/UX objetivo

### 3.1 Cliente — tarjeta de pago (una sola decisión)

```
┌──────────────────────────────────────────────┐
│ [foto] Carlos Ríos llevará tu pedido          │
│        Envío S/ 7.50                           │
├──────────────────────────────────────────────┤
│ ( ) Pagar ahora                                │
│     Yape + comprobante · S/ 27.50              │
│ ( ) Pagar al recibir                           │
│     S/ 27.50 al entregarte el pedido           │
├──────────────────────────────────────────────┤
│  (según opción)                                │
│  Al recibir → [ Confirmar ]                    │
│  Ahora      → QR · número · comprobante ·      │
│               [ Ya pagué, confirmar ]          │
│  No podrás cambiarlo después.                  │
└──────────────────────────────────────────────┘
```
Principios (ui-ux-pro-max): una acción primaria por estado; revelado progresivo de **un** nivel; **sin preselección** (es dinero); el estado deshabilitado se explica con una línea; objetivo táctil ≥ 40 px; el significado nunca solo por color.

### 3.2 Repartidor — entrega

```
COBRO AL ENTREGAR
S/ 27.50                  ← text-3xl, tabular
Comida 20.00 + Envío 7.50
[ Mostrar mi QR ]         ← primario secundario (variant default)
(…) No pude cobrar        ← enlace de texto

[ Finalizar entrega ]     ← único CTA lleno (lime)
```
- Sin "El cliente indicó…", sin fila de número fuera del diálogo, sin selector, sin checkbox.
- Sin QR cargado: el botón abre el diálogo con el **número** (ya implementado) y una línea "Súbelo en tu perfil".

### 3.3 Tabla de copy (antes → después)

| Antes | Después |
|---|---|
| "¿Cómo quieres pagar?" + "¿Con qué pagarás?" + "Elige una opción para continuar" | "¿Cómo quieres pagar?" (ayuda solo mientras no elija) |
| Subtítulo: "Cuando te entreguen el pedido (efectivo o Yape)." | "S/ 27.50 al entregarte el pedido" |
| Panel: "Le pagarás a {n} al recibir… Comida + envío. Yapeas cuando te entregue…" | *(eliminado; el monto ya está en la opción)* |
| "Total a pagarle al repartidor: S/ X" (header) | *(eliminado)* |
| Toast: "¡Listo! Tu repartidor ya puede ir por tu pedido. Pagarás S/ X en efectivo cuando te lo entregue." | "Listo. Tu repartidor va por tu pedido." |
| Estado: "Recuerda: pagas S/ X por Yape cuando te entregue… [Ver QR de mi repartidor]" | *(eliminado; la nota vive en el resumen)* |
| Resumen: chip "Efectivo al recibir"/"Yape al recibir" + nota larga | Chip "Pago al recibir" + "Pagas S/ X al recibir." |
| Repartidor: "¿Cómo te pagó?" + radios + "Ya vi el yapeo de S/ X…" + aviso "PideloYa no puede verificar…" | "Finalizar entrega" |
| Chip lista: "Cobrar S/ X al entregar · pagará con Yape" | "Cobrar S/ X al entregar" |

---

## 4. Fases

| Fase | Nombre | Tipo | Prioridad |
|---|---|---|---|
| 1 | Base de datos: relajar constraints y funciones | 1 migración nueva + editar doc contract | **Alta** |
| 2 | Backend: constantes, validación, acciones, API, tipos | Backend | **Alta** |
| 3 | UI Repartidor: cobro y "Finalizar" | Frontend | **Alta** |
| 4 | UI Cliente: elección en un nivel y paneles | Frontend | **Alta** |
| 5 | Resumen, estado y limpieza de textos del flujo | Frontend | Media-Alta |
| 6 | Admin, restaurante y textos legales | Full-stack | Media |
| 7 | Accesibilidad y responsive | QA | **No negociable** |
| 8 | QA (E2E + checklist manual) | QA | Obligatoria |
| 9 | Despliegue, contract y rollback | DevOps | Obligatoria |

**Orden:** `1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9`. Repartidor (3) antes que cliente (4): si el cliente pudiera confirmar "al recibir" sin método antes de que el repartidor sepa finalizar sin declararlo, la entrega quedaría bloqueada.

---

## Fase 1 — Base de datos (única migración nueva)

**Archivo nuevo:** `supabase/migrations/20261003100000_pay_on_delivery_without_method.sql`

Patrón *expand*: **relaja** reglas; todo lo desplegado hoy sigue funcionando.

### 1.1 Constraints (`deliveries`)

```sql
-- "Al recibir" ya no lleva método. Las filas legacy (CASH/YAPE + ON_DELIVERY) siguen siendo válidas.
alter table public.deliveries drop constraint if exists deliveries_method_timing_pair_check;
alter table public.deliveries add constraint deliveries_timing_method_check check (
  (payment_timing is null and payment_method is null)
  or (payment_timing = 'UPFRONT' and payment_method = 'YAPE')
  or (payment_timing = 'ON_DELIVERY')            -- payment_method puede ser NULL (nuevo) o legacy
);

-- collected_at = "el repartidor finalizó con cobro"; collected_method pasa a ser opcional (solo legacy).
alter table public.deliveries drop constraint if exists deliveries_collected_pair_check;
alter table public.deliveries drop constraint if exists deliveries_collected_check;
alter table public.deliveries add constraint deliveries_collected_check check (
  collected_at is null or payment_timing = 'ON_DELIVERY'
);
alter table public.deliveries add constraint deliveries_collected_method_check check (
  collected_method is null or collected_method in ('YAPE','CASH')
);
```
`orders.payment_method` ya admite `NULL`. Sin backfill (los datos existentes cumplen las reglas nuevas).

### 1.2 `select_delivery_payment` (misma firma `(uuid,text,text,text)`)

`create or replace` con **`p_method` default `null`** (agregar un default está permitido; si Postgres objetara, `drop` + `create` en la misma transacción). Orden de validaciones y `errcode` **idénticos** a v2 (identidad → timing → existencia → dueño → idempotencia → estado → repartidor → tarifa → específicas). Cambios:

| `p_timing` | Resultado |
|---|---|
| `UPFRONT` (o `null` con `p_method='YAPE'`/`null`) | Igual que hoy: método forzado a `'YAPE'`, comprobante **obligatorio** y existente en Storage. `p_method='CASH'` → `22000` "El efectivo solo se paga al recibir" (compat). |
| `ON_DELIVERY` (o `null` con `p_method='CASH'`) | **`payment_method` se guarda `NULL`** aunque llegue `'CASH'`/`'YAPE'` (compatibilidad con la app desplegada). Ruta de comprobante ≠ null → `22000`. Exige `allows_pay_on_delivery` (D7, sin cambios). |
| ambos `null` | Se deriva `UPFRONT` (comportamiento de hoy con `YAPE` por defecto). |

Escribe `deliveries.{payment_method, payment_timing, payment_confirmed_at, accepted_at, payment_voucher_path}` y `orders.{status, delivery_fee, payment_method, payment_timing}`. El envoltorio `confirm_delivery_payment(uuid,text)` no cambia.

### 1.3 `complete_delivery` (misma firma `(uuid, boolean, text)`)

`create or replace`, **sin cambiar parámetros** (la app desplegada y la nueva siguen resolviendo la misma función):
- Se **elimina** la guarda `22000 "Confirma que cobraste…"`.
- `ON_DELIVERY`: `collected_at = now()`; `collected_method` queda `NULL` (los parámetros `p_cash_collected`/`p_collected_method` se **ignoran**).
- `UPFRONT`/legacy: igual que hoy.
- Se **deja de escribir** `cash_collected_at` (el dual-write ya no tiene sentido sin método).
- Locks, pertenencia por fila, override ADMIN y `40001`: idénticos.

### 1.4 Doc contract (editar, no crear)
Actualizar `docs/db-contract/20261002100600_drop_legacy_payment_columns.sql`: la firma unificada pasa a **`complete_delivery(p_order_id uuid)`** sin guarda de cobro, y el rollback verbatim refleja el cuerpo vigente. El resto (drop de `cash_collected_at`, endurecer `orders_update_delivery_assigned`) no cambia.

### 1.5 Criterios de aceptación
- [ ] `select_delivery_payment(o, null, null, 'ON_DELIVERY')` → `ASSIGNED`, `payment_method` **NULL**, `payment_timing='ON_DELIVERY'`, sin `payment_voucher_path`.
- [ ] Llamada legacy `('CASH', null, null)` y `('YAPE', null, 'ON_DELIVERY')` → mismo resultado (método NULL).
- [ ] `UPFRONT` sin comprobante → `22000`; con comprobante válido → igual que hoy.
- [ ] `complete_delivery(o)` en `ON_DELIVERY` **sin flags** → `DELIVERED`, `collected_at` poblado, `collected_method` NULL.
- [ ] `UPFRONT` ignora todo; repartidor ajeno → `42501`; `anon` → `42501`; pedido no `ON_THE_WAY` → `22000`.
- [ ] Filas históricas intactas; `db push --dry-run` limpio.

---

## Fase 2 — Backend

### 2.1 `lib/constants/payment-method.ts`
- Eliminar `ON_DELIVERY_METHOD_COPY`, `PAYMENT_METHOD_COPY`, `cashAmountDue` (alias) y `PAYMENT_METHOD_PROMPT` verboso.
- `PAYMENT_TIMING_COPY` pasa a funciones de monto: `UPFRONT → "Yape + comprobante · S/ X"`, `ON_DELIVERY → "S/ X al entregarte el pedido"`.
- `PAYMENT_METHOD_LOCK_NOTICE` → `"No podrás cambiarlo después."` (única fuente; se renderiza **una vez**).
- `paymentLabel(method, timing)`: `ON_DELIVERY` (con o sin método legacy) → **"Pago al recibir"**; `UPFRONT` → **"Yape (pagado)"**; `null` → `null`.
- `toPaymentMethod` se conserva (datos legacy).

### 2.2 `lib/validations/payment-method.ts`
`paymentSelectionSchema` → `z.object({ timing: paymentTimingSchema })`. Se elimina el `refine` CASH+UPFRONT y el método de la validación del cliente.

### 2.3 Server Actions
- `confirmDeliveryPayment(orderId, { timing })`: llama `select_delivery_payment` con `p_timing` y `p_voucher_path` **solo si `UPFRONT`**; `p_method` no se envía.
- `advanceOrderStatus(orderId, current, opts)`: el último paso llama `complete_delivery({ p_order_id })` **sin** `p_collected_method`; se elimina `opts.collected/collectedMethod`. `restaurantPaid` se conserva.

### 2.4 API v1 (paridad)
- `PUT /api/v1/orders/[id]` `confirm_payment`: acepta `{ timing? }`; **compat:** `{ method:'CASH' }` ⇒ `ON_DELIVERY`, `{ method:'YAPE' }` o sin cuerpo ⇒ `UPFRONT`.
- `PUT /api/v1/orders/[id]` `advance` y `PUT /api/v1/deliveries/[orderId]/advance`: el último paso llama `complete_delivery({ p_order_id })`; se ignoran `collected`/`collected_method` si llegan. Override ADMIN sin cambios.

### 2.5 Tipos
`types/database.ts` (`select_delivery_payment.p_method` opcional), `types/order.ts` (`payment_method` y `collected_method` ya nullable; marcar como *legacy*).

### 2.6 Criterios
- [ ] `pnpm typecheck` limpio; `grep` sin llamadas con `collectedMethod`/`cashAmountDue`.
- [ ] API sin cuerpo sigue confirmando por Yape adelantado.

---

## Fase 3 — UI Repartidor

**Archivos:** `app/repartidor/pedidos/[id]/page.tsx`, `AdvanceStatusButton.tsx`, `DeliveryOrdersClient.tsx`, `CourierQrDialog.tsx`, `PickupDialog.tsx`, `SendOfferForm.tsx`, `AvailableOrdersClient.tsx`, `PayOnDeliverySwitch.tsx`. **Eliminar:** `CollectPaymentDialog.tsx`.

### 3.1 Detalle de la entrega (`page.tsx`)
Bloque "Cobro al entregar" (solo `ON_DELIVERY`, o legacy CASH sin timing):
1. Monto grande + una línea de desglose.
2. `CourierQrDialogButton` (siempre visible; con QR muestra QR, sin QR muestra número). Se mantiene el aviso "Súbelo en tu perfil" **solo si no hay QR**, en una línea.
3. **Eliminar:** "El cliente indicó…", la fila copiable del número (el número vive dentro del diálogo), el párrafo "Cobra antes de entregar…" y las consultas/props `paymentMethod`/`collectedMethod`.
4. Tras finalizar: una línea `Cobrado el {fecha}` (`role="status"`).
- Se conservan el bloque de comprobante (UPFRONT) y el borde `amber-600` (contraste medido).

### 3.2 `AdvanceStatusButton`
- `ON_THE_WAY`: botón **"Finalizar entrega"** → `advanceOrderStatus(id,'ON_THE_WAY')` directo (S2). Estados `isPending` y toast de una línea: "Entrega finalizada".
- Si el pedido es `ON_DELIVERY`, se agrega bajo/junto al botón el **enlace de texto "No pude cobrar"** que abre `PaymentIncidentDialog` (S3). Para UPFRONT/legacy no aparece.
- Se eliminan las props `paymentMethod`, `cashAmount` y el estado `collectOpen`. `ASSIGNED` sigue abriendo `PickupDialog`.

### 3.3 `PickupDialog` (S6)
Título "¿Pagaste S/ X en {restaurante}?"; **una** frase de cuerpo (ON_DELIVERY: "Adelantas S/ X; el cliente te los devuelve al entregar." · UPFRONT: se omite). Botón primario "Sí, pagué y recogí"; secundario "Recoger sin pagar". Misma lógica `restaurantPaid`.

### 3.4 Listas
- `DeliveryOrdersClient`: chip único `Cobrar S/ X al entregar` (texto + ícono `BanknoteIcon`, sin variantes por método). Se elimina la rama "Cobrado" (el pedido ya sale de la lista al entregarse). `AWAITING_PAYMENT`: "Esperando que el cliente elija cómo pagar."
- `SendOfferForm`: se **elimina** la línea de ayuda y la prop `foodAmount`; la línea única vive en `AvailableOrdersClient` ("Comida S/ X · si pagan al recibir, la adelantas tú" / "solo pago por adelantado").
- `PayOnDeliverySwitch`: dejar un solo párrafo de ayuda (2 frases).

### 3.5 `CourierQrDialog`
Sin cambios funcionales; confirmar que el título usa el total (comida + envío) y que sin QR muestra el número.

### 3.6 Criterios
- [ ] El repartidor ve monto + "Mostrar mi QR" + "Finalizar entrega"; **ningún** selector ni checkbox.
- [ ] Finalizar un pedido `ON_DELIVERY` deja `collected_at` y marca `DELIVERED` en un toque.
- [ ] "No pude cobrar" crea la incidencia y **no** cambia el estado.
- [ ] Sin QR ni número: el diálogo lo dice sin romperse.
- [ ] UPFRONT/legacy: flujo idéntico a hoy, sin enlace de incidencia.

---

## Fase 4 — UI Cliente

**Archivos:** `PaymentMethodChoice.tsx`, `DeliveryPaymentCard.tsx`, `YapePaymentPanel.tsx`. **Eliminar:** `CashPaymentPanel.tsx`, `YapeOnDeliveryPanel.tsx`.

### 4.1 `PaymentMethodChoice` (un nivel)
- Props: `timing`, `onTimingChange`, `disabled`, `allowsOnDelivery`, `amount` (string). **Se quitan** `method`, `onMethodChange` y el `<fieldset>` anidado.
- Dos radios nativos (`sr-only` + `peer-checked`), `min-h-14`, **sin preselección**.
- Subtítulos: `Pagar ahora` → "Yape + comprobante · S/ {amount}"; `Pagar al recibir` → "S/ {amount} al entregarte el pedido". Si `allowsOnDelivery=false`: opción deshabilitada con "Este repartidor solo acepta pago por adelantado".
- Se conservan el halo de foco (`focus-halo`) y el indicador no dependiente del color.

### 4.2 `DeliveryPaymentCard`
- Estado: `timing`, `file`, `phase` (se elimina `method`). `busy` derivado de `phase`.
- Header: avatar + "{nombre} llevará tu pedido" + "Envío S/ X". **Se elimina** "Total a pagarle al repartidor".
- **Pagar al recibir:** botón único "Confirmar pago al recibir" (`h-11`, ancho completo) + `PAYMENT_METHOD_LOCK_NOTICE` debajo. Sin panel, sin QR, sin diálogo.
- **Pagar ahora:** `YapePaymentPanel` (carga diferida `next/dynamic` como hoy) con el flujo `preparing → uploading → confirming` sin cambios.
- Ayuda "Elige una opción…" solo mientras `timing === null`; **ningún CTA** hasta elegir.
- Toasts: "Listo. Tu repartidor va por tu pedido."

### 4.3 `YapePaymentPanel` (recorte, sin cambios funcionales)
- Quitar el aviso de bloqueo propio (queda el de la tarjeta) y los encabezados numerados 1/2/3 (el orden visual ya es claro); dejar un único título "Paga S/ {amount} por Yape".
- Mantener: QR tocable, número con `CopyButton`, picker, botón, y la explicación del botón deshabilitado ("Adjunta tu comprobante").

### 4.4 Criterios
- [ ] "Pagar al recibir" **no** muestra sub-opciones ni QR; confirma en un toque.
- [ ] Resultado en base: `payment_timing='ON_DELIVERY'`, `payment_method` NULL, sin voucher.
- [ ] "Pagar ahora" se comporta como hoy (voucher obligatorio, archivo conservado al alternar opciones).
- [ ] El texto "No podrás cambiarlo después." aparece **una sola vez** en pantalla.
- [ ] Repartidor con toggle apagado: "Pagar al recibir" deshabilitada con motivo.
- [ ] El bundle inicial sigue sin incluir `compress-voucher` ni el picker hasta elegir "Pagar ahora".

---

## Fase 5 — Resumen, estado y limpieza transversal

**Archivos:** `OrderSummaryCard.tsx`, `OrderStatusSection.tsx`, `app/cliente/pedidos/[id]/page.tsx`, `OrdersListClient.tsx`, `OrderStatusAnnouncer.tsx`, `lib/constants/order-status.ts`.

- **`OrderSummaryCard`:** chip de `paymentLabel`; nota única: `ON_DELIVERY` → "Pagas S/ X al recibir." · `UPFRONT` → "Pagaste S/ X por Yape." · sin método → sin nota. Fila del comprobante: "Comprobante enviado" + botón "Ver" (se quita la frase explicativa).
- **`OrderStatusSection`:** **eliminar** el recordatorio ámbar y el diálogo "Ver QR de mi repartidor"; se quitan las props `paymentMethod`, `paymentTiming`, `cashAmount`, `courierQrUrl/Name/Phone` y su `Image`/`Dialog`.
- **`page.tsx`:** dejar de calcular `courierQrUrl/Name/Phone` y `cashAmount` para el estado (la RPC `get_delivery_offer_details` se sigue llamando para la tarjeta y el comprobante).
- **Copy transversal:** `OrdersListClient` banner → "Tu repartidor ya está listo — elige cómo pagar el envío" (subtítulo eliminado si repite); `OrderStatusAnnouncer` toast → "Tu repartidor envió su oferta. Elige cómo pagar."

### Criterios
- [ ] Un pedido `ON_DELIVERY` muestra "Pagas S/ X al recibir." en **un solo lugar**.
- [ ] Pedidos legacy (método con valor) y `NULL` renderizan sin errores ni chips contradictorios.
- [ ] `grep` de "por Yape" sobre pantallas de pedidos `ON_DELIVERY` → 0 coincidencias.

---

## Fase 6 — Admin, restaurante y textos legales

- **Admin (`query-builders.ts`, `app/admin/pagos/page.tsx`, `PaymentReviewTable`, `app/api/admin/export/route.ts`):** quitar el filtro **`mismatch`** (constante, etiqueta y `fetchPaymentReconciliationRows`). Se conservan `open`, `unpaid` e `integrity` (ON_DELIVERY entregado sin `collected_at`). El CSV usa la misma lista.
- **Restaurante:** sin cambios (solo ve si/cuándo se le pagó).
- **`privacidad`:** en "Datos que recopilamos" reemplazar "método elegido (Yape o efectivo), … cobro declarado" por "momento del pago (ahora o al recibir), constancia de finalización de la entrega, constancia de pago al restaurante e incidencias de pago". Subir `UPDATED_AT`.
- **`terminos` §6:** reescribir en 3 párrafos: (1) pago de productos/envío es al repartidor, ahora con Yape y comprobante o al recibir; (2) PideloYa no procesa ni custodia dinero ni verifica pagos, el comprobante es declaración de las partes; (3) incidencias y suspensión por falta de pago. Se elimina la mención a "declarar el método con el que cobró". **D10 sigue abierto: validar con abogado/contador.**
- **`decisions-and-learnings.md`:** registrar S1–S6 y la lección "una decisión que nadie consume no se pregunta".

---

## Fase 7 — Accesibilidad y responsive (no negociable)
1. **Contraste (medir, no estimar):** chip "Cobrar…", monto `text-3xl`, subtítulos `text-xs` de las dos opciones; bordes de radios ≥ 3:1 (ya medidos: `black/45`, `amber-600`).
2. **Teclado:** un solo `fieldset` con dos radios (flechas, foco visible con `focus-halo`); botón "Finalizar entrega" alcanzable sin trampa.
3. **Lector de pantalla:** `legend`, `DialogTitle` en el diálogo del QR, región `aria-live` para "Cobrado el…".
4. **Táctil:** opciones `min-h-14`, CTA `h-11`/`h-10`; "No pude cobrar" con área ≥ 40 px aunque sea enlace.
5. **Sin animaciones nuevas** (`prefers-reduced-motion` ya cubierto). Sin CLS: el esqueleto de `YapePaymentPanel` se mantiene.
6. **360 / 428 / 768 / 1280 px:** una columna, sin scroll horizontal, QR `max-w-full`.

---

## Fase 8 — QA

### 8.1 E2E (`scripts/e2e-delivery-offer.mjs`, local)
Actualizar los casos de efectivo/Yape-al-recibir de los 72 existentes y agregar:
- `confirm_payment {timing:'ON_DELIVERY'}` → `ASSIGNED`, `payment_method` NULL, sin voucher, `collected_at` NULL.
- Compat: `{method:'CASH'}` ⇒ ON_DELIVERY; sin cuerpo ⇒ UPFRONT; `{method:'YAPE', timing:'ON_DELIVERY'}` ⇒ método NULL.
- `ON_DELIVERY` con ruta de comprobante → 400; toggle apagado → 400; UPFRONT sin voucher → 400.
- Finalizar `ON_DELIVERY` **sin cuerpo** → `DELIVERED` + `collected_at`; repartidor ajeno → 403; ya entregado → 400.
- "No pude cobrar" no cambia el estado (regresión Fase 8 anterior).
- Se **eliminan** las pruebas de "cobro sin declarar → 400" y de `mismatch`.
- Regresión: cancelar/retirar/expirar siguen sin dejar timing ni voucher; anonimización intacta.
Scripts `verify-*.mjs`: ajustar aserciones de constraints (nuevo CHECK de pareja).

### 8.2 Checklist manual
- [ ] Cliente: "Pagar al recibir" → un toque → pedido en camino; no aparece ningún QR ni pregunta de método.
- [ ] Cliente: "Pagar ahora" completo (QR, comprobante, confirmar) como hoy.
- [ ] Repartidor: monto + "Mostrar mi QR" (celular real, modo oscuro) → "Finalizar entrega" en un toque.
- [ ] "No pude cobrar" → incidencia en `/admin/pagos`; pedido sigue en camino.
- [ ] Repartidor sin QR/sin número: degradación sin roturas.
- [ ] Pedidos legacy (con método): sin errores.
- [ ] Textos: el monto y "No podrás cambiarlo" aparecen una vez; sin duplicados cliente/repartidor.
- [ ] Teclado, lector de pantalla, modo oscuro, `prefers-reduced-motion`, 360 px.
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm build` en verde.

---

## Fase 9 — Despliegue, contract y rollback

> **Nota de ejecución (Fases 1–3 implementadas):** tras el `db push`, la app
> desplegada sigue funcionando en todo el flujo **salvo un caso**:
> `complete_delivery` nueva ignora los parámetros de cobro, así que un pedido
> `ON_DELIVERY` ya no se puede cerrar desde la app vieja (la guarda
> "Confirma que cobraste…" desapareció). Es exactamente el bloqueo que este
> plan quiere eliminar, pero significa que migración y código deben salir
> **juntos y en ese orden**: migración → código. Al revés, el código nuevo
> llamaría a la firma vieja con el flag legado.

| # | Paso | Por qué |
|---|---|---|
| 1 | `db push` de `20261003100000_pay_on_delivery_without_method.sql` | Solo relaja reglas; **la app desplegada sigue funcionando** (mismas firmas, defaults compatibles). |
| 2 | `types/database.ts` + código (Fases 2–6) **juntos** | Cliente y repartidor deben salir a la vez: si el cliente confirma "al recibir" sin método y el repartidor aún pide declararlo, la entrega queda bloqueada. |
| 3 | QA con dos sesiones y un celular real | Verificación extremo a extremo. |
| 4 | Migración *contract* (el doc revisado en 1.4) → mover a `supabase/migrations/` **solo ahora**, con un timestamp POSTERIOR | Cierra `cash_collected_at`, unifica `complete_delivery(uuid)` y endurece la policy. No antes: el próximo `db push` lo aplicaría y rompería la app desplegada. **Ojo con el nombre:** el archivo se llama `20261002100600_…`, que ordena ANTES de `20261003100000`; movido tal cual, un `db push` aplicaría el DROP de la columna y de la firma antes de la migración que lo hace posible. Al moverlo, renombrarlo (p. ej. `20261003110000`) y quitar `cash_collected_at` de los `select` de `scripts/*.mjs` en el mismo cambio. |

### Estado de la ejecución (actualizado 2026-10-02)

| Fase | Estado |
|---|---|
| 1–7 | **Implementadas.** `pnpm typecheck`, `pnpm lint` (0 errores) y `pnpm build` en verde; contraste y layout medidos en un render real. |
| 8.1 | **Ejecutada en verde contra BD real + prod :3000.** E2E `e2e-delivery-offer.mjs`: **72 PASS / 0 FAIL** (fixtures → janitor → suite). `verify-timing-phase1`, `verify-delivery-payment-phase1` y `verify-payment-api-phase2`: **0 FAIL** tras adaptar selects/asserts al contrato nuevo (p. ej. `p_method null` ya deriva UPFRONT y responde con la guarda del comprobante). `verify-payment-incidents-phase8`: 24 PASS / 0 FAIL, intacta. | 
| 8.2 | **Pendiente (humano + celular).** Checklist manual sin cambios. |
| 9.1 (`db push`) | **Aplicado en el proyecto real.** Migraciones en remote (migration list local=remote ✅): `20261003100000` (expand del plan) + hotfixes `20261003100100` (`default null` en `p_method`; sin él PostgREST fallaba con PGRST203) y `20261003100200` (fix del agujero de lógica trivalente en `deliveries_timing_method_check`: `IS NOT DISTINCT FROM` para el par UPFRONT/método). | 
| 9.2 (deploy) | **Pendiente: falta definir el destino** (no hay `vercel.json` / `fly.toml` / `Dockerfile` detectados). |
| 9.3 (QA celular) | **Cubierto por 8.2** (mismo checklist, requiere el celular real). |
| 9.4 (contract) | **Preparado, no movido.** El doc de contract ya trae el aviso del renombre (`20261003110000`) y el checklist verificado por grep: la app no lee `cash_collected_at`, pero los `scripts/*.mjs` sí lo seleccionan y hay que quitarlo en el mismo cambio. Posterior al deploy. |

**Rollback:** revertir código es seguro tras el paso 1 (las reglas relajadas aceptan también los datos viejos). **No** reponer el CHECK de pareja si ya existen pedidos con `ON_DELIVERY` y método NULL (la migración fallaría). Rollback del contract: script verbatim dentro del doc.

---

## 10. Resumen de archivos

### Nuevo (3)
- `supabase/migrations/20261003100000_pay_on_delivery_without_method.sql` (aplicada en remote)
- `supabase/migrations/20261003100100_select_delivery_payment_p_method_default.sql` (hotfix PGRST203, aplicada)
- `supabase/migrations/20261003100200_timing_method_check_trivalent_fix.sql` (hotfix CHECK trivalente, aplicada)

### Eliminados (quedan sin uso)
- `components/features/orders/CashPaymentPanel.tsx`
- `components/features/orders/YapeOnDeliveryPanel.tsx`
- `components/features/deliveries/CollectPaymentDialog.tsx`

### Modificados
- **Backend:** `lib/constants/payment-method.ts`, `lib/validations/payment-method.ts`, `lib/actions/orders.ts`, `lib/actions/deliveries.ts`, `app/api/v1/orders/[id]/route.ts`, `app/api/v1/deliveries/[orderId]/advance/route.ts`, `types/database.ts`, `types/order.ts`
- **Cliente:** `PaymentMethodChoice.tsx`, `DeliveryPaymentCard.tsx`, `YapePaymentPanel.tsx`, `OrderSummaryCard.tsx`, `OrderStatusSection.tsx`, `OrdersListClient.tsx`, `OrderStatusAnnouncer.tsx`, `app/cliente/pedidos/[id]/page.tsx`
- **Repartidor:** `app/repartidor/pedidos/[id]/page.tsx`, `AdvanceStatusButton.tsx`, `PickupDialog.tsx`, `DeliveryOrdersClient.tsx`, `SendOfferForm.tsx`, `AvailableOrdersClient.tsx`, `CourierQrDialog.tsx` (revisión), `PayOnDeliverySwitch.tsx`
- **Admin/legal:** `lib/admin/query-builders.ts`, `app/admin/pagos/page.tsx`, `app/api/admin/export/route.ts`, `app/(public)/privacidad/page.tsx`, `app/(public)/terminos/page.tsx`
- **Docs/scripts:** `docs/db-contract/20261002100600_drop_legacy_payment_columns.sql`, `docs/decisions-and-learnings.md`, `scripts/e2e-delivery-offer.mjs` *(local)*

---

## 11. Riesgos

| Riesgo | Mitigación |
|---|---|
| Repartidor finaliza sin cobrar (un toque, sin atestación) | Conservar "No pude cobrar" (S3); `collected_at` + `integrity` en admin dejan rastro; la constancia de pago al restaurante sigue en recogida. **Es la contrapartida consciente de S2.** |
| Pérdida del dato "con qué pagó" | Aceptado (S1): nadie lo consumía; si se necesita, se agrega después. |
| Confirmar "al recibir" por error (un toque) | Aviso visible antes del clic + opción sin preselección; sigue irrevocable por diseño. |
| App desplegada rota entre `db push` y deploy | Firmas intactas y reglas solo relajadas (Fase 1). |
| Texto legal desalineado | Fase 6 en el mismo release; revisión legal pendiente (D10). |
