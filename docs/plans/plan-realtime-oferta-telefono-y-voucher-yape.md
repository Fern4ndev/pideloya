# Plan de Implementación — Oferta en Tiempo Real, Número del Repartidor con "Copiar" y Voucher de Pago por Yape

**Proyecto:** PideloYa
**Módulo:** `/cliente/pedidos/[id]` (detalle de pedido del cliente) y, por extensión, `/repartidor/pedidos/[id]`
**Autor del plan:** Revisión técnica estilo senior (+20 años), sobre el código real del repo.

**Alcance (los tres pedidos):**

1. **Bug — tiempo real:** cuando el repartidor envía su oferta, la tarjeta de pago (foto, QR, tarifa) debe aparecer en el panel del cliente **sin refrescar la página**.
2. **Copy:** eliminar el párrafo *"Escanea el QR y paga S/ X por Yape. Cuando lo hayas hecho, confirma abajo: no verificamos el pago automáticamente…"* y, en su lugar, mostrar el **número del repartidor con un botón de copiar (con ícono)** al lado.
3. **Feature:** que el cliente **suba su voucher (comprobante) del Yape** en el mismo módulo.

> **Nota sobre la skill `ui-ux-pro-max`:** no tengo acceso a su `SKILL.md` desde este entorno. Aplico los mismos principios que el proyecto ya cita de ella en `plan-mejora-ui-panel-cliente.md`: una acción primaria por pantalla, feedback inmediato en el punto donde el usuario actuó, no depender solo del color ni del hover, objetivo táctil ≥ 40×40 px, estados de carga/error/vacío tratados como parte del diseño, contraste medido y `prefers-reduced-motion` respetado.

---

## Supuestos y decisiones que conviene validar (léelas primero)

| # | Decisión tomada en este plan | Por qué | Cómo se cambia si no te convence |
|---|---|---|---|
| D1 | **El voucher es obligatorio para confirmar el pago.** | Al quitar el aviso de "no verificamos el pago", el voucher pasa a ser la única evidencia que tiene el repartidor. Sin él, el botón "Ya pagué" sigue siendo una declaración sin respaldo. | Quitar la validación `p_voucher_path is null` en la función SQL (Fase 2.4) y el `disabled` del botón (Fase 4.4). Es un cambio de dos líneas. |
| D2 | **El voucher se sube en el mismo momento en que el cliente pulsa "Ya pagué, confirmar"** (archivo en memoria hasta ese clic). | Elimina de raíz el caso "cliente subió voucher pero el repartidor retiró su oferta / expiró": nunca hay un voucher huérfano de una oferta viva. Un solo paso para el cliente. | Subir al elegir el archivo exige además bloquear retirar/expirar ofertas con voucher (complejidad que este diseño evita). |
| D3 | **Storage: bucket privado de Supabase con URLs firmadas**, no ImageKit. | Un voucher de Yape contiene nombre, monto y número de operación: dato financiero personal (Ley 29733, ya asumida por el proyecto). Las URLs de ImageKit que usa el proyecto son públicas. Supabase Storage permite RLS por carpeta y URLs que expiran. | Alternativa: ImageKit con `isPrivateFile` + URLs firmadas; funciona pero pierde RLS y obliga a servir todo por servidor. |
| D4 | **Un solo archivo por pedido** (`{order_id}/voucher.jpg`, se sobreescribe con `upsert`). | Acota los huérfanos a 1 por pedido y hace trivial la limpieza y la RLS. El cliente re-encodea a JPEG en el navegador, así que la extensión es siempre `.jpg`. | Permitir varios comprobantes requiere una tabla `payment_vouchers` (queda como mejora futura). |
| D5 | **El número mostrado es `profiles.phone` del repartidor** (9 dígitos, ya validado en el registro con `^9\d{8}$`). | Yape en Perú se asocia al celular; el registro ya lo pide. No hay que agregar ninguna columna. | Si algún día Yape ≠ celular, agregar `yape_phone` a `profiles` y cambiar una sola función SQL. |

---

## Índice de fases

| Fase | Nombre | Tipo | Prioridad |
|---|---|---|---|
| 0 | Diagnóstico (causa raíz del bug de tiempo real) | Lectura | — |
| 1 | Corrección de tiempo real del detalle de pedido | Frontend | **Crítica (hotfix independiente)** |
| 2 | Base de datos: teléfono en la oferta, bucket privado, columnas y funciones | Migraciones SQL | Alta |
| 3 | Backend: Server Actions, API v1 y tipos | Backend | Alta |
| 4 | UI: rediseño de `DeliveryPaymentCard` (copy, teléfono, voucher) | Frontend / UX | Alta |
| 5 | El comprobante después de confirmar (cliente) y para el repartidor | Frontend | Alta |
| 6 | Ciclo de vida, limpieza y privacidad (Ley 29733) | Backend + legal | Alta |
| 7 | Accesibilidad, motion y responsive | QA | No negociable |
| 8 | QA: suite E2E + checklist manual | QA | Obligatoria |
| 9 | Orden de despliegue y rollback | DevOps | Obligatoria |

**Orden recomendado:** `1` (se puede desplegar sola hoy) → `2` → `3` → `4` → `5` → `6` → `7` → `8` → `9`.
La Fase 1 no depende de nada y resuelve el bug visible; el resto es la feature nueva.

---

## Fase 0 — Diagnóstico

### 0.1 — Por qué la tarjeta no aparece sin refrescar (causa raíz exacta)

Verificado en el código:

1. `app/cliente/pedidos/[id]/page.tsx` es un **Server Component**. Solo llama a la RPC `get_delivery_offer_profile` **en el momento del render** y **solo si** `order.status === 'AWAITING_PAYMENT'`. Si el cliente abrió la página cuando el pedido estaba `PENDING`, `deliveryOffer` queda `null` y la tarjeta simplemente no existe en el árbol.
2. `OrderStatusSection` (Client Component) **sí** escucha `postgres_changes` sobre `orders` con `filter: id=eq.<id>` y actualiza su `useState` local. Por eso el **timeline avanza** solo… pero ese estado es **privado del componente**: la página (servidor) nunca se entera. Es la mitad del arreglo que ya existe y nunca se conectó con el resto.
3. Consecuencia en cadena: además de la tarjeta, tampoco se actualizan sin refrescar el **monto de envío** del desglose ("Por confirmar") ni `orders.delivery_fee` tras confirmar.

**Conclusión:** no es un problema de Supabase Realtime (los eventos llegan, el timeline lo prueba). Es un problema de **arquitectura de datos**: el estado que decide qué se dibuja vive en el servidor y el evento solo alcanza a un hijo aislado.

### 0.2 — Piezas ya existentes que se reutilizan (no se reinventa nada)

- `components/ui/realtime-refresh.tsx` → suscripción a Postgres Changes con *debounce* + `router.refresh()`. Ya lo usan admin y restaurante. Es exactamente el patrón correcto: **el evento no trae datos, solo invalida**; los datos los vuelve a leer el servidor, que ya aplica RLS y hace los joins.
- `orders` ya está en la publicación `supabase_realtime` con `REPLICA IDENTITY FULL` (migración `20260922103915`), y la policy `orders_select_own_customer` deja al cliente recibir eventos de sus pedidos.
- `offer_delivery()` inserta en `deliveries` **y** actualiza `orders` en una sola transacción: cuando llega el `UPDATE` de `orders` a `AWAITING_PAYMENT`, la fila de `deliveries` **ya está confirmada**. Por eso basta escuchar `orders`; no hace falta un canal para `deliveries`.

### 0.3 — Lo que no existe y hay que construir

- `get_delivery_offer_profile` **no devuelve el teléfono** → migración nueva.
- No hay bucket de vouchers, ni columna para guardar su ruta, ni forma de que `confirm_delivery_payment` la reciba.
- No hay un componente de "copiar al portapapeles" en el proyecto.

---

## Fase 1 — Corrección de tiempo real (hotfix independiente)

**Objetivo:** que cualquier cambio del pedido (oferta enviada, oferta retirada/expirada, pago confirmado, avance del repartidor, cancelación) se refleje en la página completa, sin refrescar y sin estados duplicados.

**Principio:** *una sola fuente de verdad.* El servidor decide qué se dibuja; el cliente solo le avisa cuándo volver a preguntar.

### 1.1 — Extender `RealtimeRefresh` (aditivo, sin romper admin/restaurante)

Dos huecos clásicos del tiempo real que hoy el componente no cubre:

- **Carrera SSR → suscripción:** entre que el servidor renderizó y el canal quedó `SUBSCRIBED` puede pasar un evento que nadie escuchó (justo el caso "el repartidor ofertó mientras cargaba la página").
- **Pestaña en segundo plano / móvil que duerme:** el WebSocket se cae y los eventos se pierden; al volver el usuario ve datos viejos.

```tsx
// components/ui/realtime-refresh.tsx — cambios (props nuevas con defaults que
// preservan el comportamiento actual de admin y restaurante)
export function RealtimeRefresh({
  channelName, table, event = '*', filter, debounceMs = 1000,
  /** Refresca una vez al quedar suscrito (y en cada re-suscripción tras una
   *  caída). Cierra la ventana entre el render del servidor y el subscribe. */
  syncOnSubscribe = false,
  /** Refresca al volver a la pestaña o recuperar el foco. */
  refreshOnFocus = false,
}: { /* ...props existentes..., */ syncOnSubscribe?: boolean; refreshOnFocus?: boolean }) {
  const router = useRouter()
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const supabase = createClient()
    const schedule = () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => router.refresh(), debounceMs)
    }

    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', { event, schema: 'public', table, filter }, schedule)
      .subscribe((status) => {
        if (status === 'SUBSCRIBED' && syncOnSubscribe) schedule()
      })

    const onVisible = () => {
      if (document.visibilityState === 'visible') schedule()
    }
    if (refreshOnFocus) document.addEventListener('visibilitychange', onVisible)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      if (refreshOnFocus) document.removeEventListener('visibilitychange', onVisible)
      supabase.removeChannel(channel)
    }
  }, [channelName, table, event, filter, debounceMs, syncOnSubscribe, refreshOnFocus, router])

  return null
}
```

### 1.2 — Montarlo en el detalle del pedido

`app/cliente/pedidos/[id]/page.tsx`:

```tsx
<RealtimeRefresh
  channelName={`customer-order-${order.id}`}   // único por pedido: no choca con 'customer-orders' de la lista
  table="orders"
  event="UPDATE"
  filter={`id=eq.${order.id}`}
  debounceMs={150}        // latencia percibida baja: es la pantalla que el cliente mira esperando
  syncOnSubscribe
  refreshOnFocus
/>
```

`debounceMs={150}` (no 1000 como en admin): aquí el usuario está **mirando la pantalla esperando** el evento; 1 s se siente roto, 150 ms se siente instantáneo y aun así agrupa ráfagas (el `UPDATE` de `orders` y otros cambios cercanos).

### 1.2b — Quitar el estado duplicado de `OrderStatusSection`

Hoy tiene su propio `useState(initialStatus)` **y** su propio canal. Con `router.refresh()` la prop `initialStatus` cambia pero el `useState` **no** se reinicializa (bug clásico de "estado derivado copiado a estado local"). Solución: derivar el estado de la prop y eliminar el canal propio.

```tsx
// OrderStatusSection.tsx — antes: useState + useEffect + createClient()
export function OrderStatusSection({ orderId, status }: { orderId: string; status: OrderStatus }) {
  if (status === 'DELIVERED') return null
  return ( /* mismo JSX que hoy, usando `status` directamente */ )
}
```

Resultado: un solo canal por página, un solo origen de datos, y timeline + tarjeta de pago + desglose de envío **siempre coherentes entre sí** (antes podían contradecirse durante unos segundos).

### 1.3 — Avisar cuando llega la oferta (UX, no solo técnica)

Que la tarjeta aparezca sola sin que el cliente se entere puede pasar desapercibido si está mirando el timeline. Componente pequeño, sin UI propia, montado en la página:

```tsx
// components/features/orders/OrderStatusAnnouncer.tsx
'use client'
export function OrderStatusAnnouncer({ status }: { status: OrderStatus }) {
  const prev = useRef(status)
  const { info, warning } = useToast()
  useEffect(() => {
    const before = prev.current
    prev.current = status
    if (before === status) return
    if (status === 'AWAITING_PAYMENT')
      info('Tu repartidor envió su oferta', 'Revisa el monto y paga por Yape.')
    if (before === 'AWAITING_PAYMENT' && status === 'PENDING')
      warning('El repartidor retiró su oferta', 'Seguimos buscando otro repartidor.')
  }, [status, info, warning])
  return (
    // Región viva: los lectores de pantalla anuncian el cambio de estado.
    <p className="sr-only" role="status" aria-live="polite">{ORDER_STATUS_LABELS[status]}</p>
  )
}
```

La tarjeta entra con `animate-fade-up` (ya existe, respeta `prefers-reduced-motion`).

### 1.4 — Criterios de aceptación de la Fase 1

- [ ] Con el detalle del pedido abierto en `PENDING`, al enviar la oferta desde otro navegador la tarjeta de pago aparece en **< 1 s**, sin recargar.
- [ ] Si el repartidor retira la oferta, la tarjeta desaparece sola y aparece el aviso.
- [ ] Al confirmar el pago, la tarjeta desaparece, el timeline avanza y el desglose muestra el envío real (antes quedaba "Por confirmar" hasta refrescar).
- [ ] Abrir la página **justo después** de que el repartidor ofertó (carrera SSR/subscribe): igual muestra la tarjeta (cubierto por `syncOnSubscribe`).
- [ ] Bloquear el teléfono 30 s y desbloquear: los datos se ponen al día solos (`refreshOnFocus`).
- [ ] Admin y restaurante **sin cambios de comportamiento** (props nuevas con defaults `false`).
- [ ] No queda ningún `useState` inicializado desde una prop que cambie por refresh.

**Archivos:** `components/ui/realtime-refresh.tsx`, `components/features/orders/OrderStatusSection.tsx`, `components/features/orders/OrderStatusAnnouncer.tsx` (nuevo), `app/cliente/pedidos/[id]/page.tsx`.

---

## Fase 2 — Base de datos

**Principio (mismo que el proyecto):** cambios aditivos; las operaciones de negocio que tocan varias tablas y las lecturas de datos sensibles pasan por funciones `SECURITY DEFINER` de superficie mínima; RLS como fuente de verdad. **Despliegue en dos pasos** para no romper el código en producción (ver Fase 9): primero se agregan las funciones nuevas *junto a* las viejas; recién después se retiran las viejas.

Cuatro migraciones (fecha de ejemplo; usar el timestamp real al crearlas).

### 2.1 — `20260930100000_payment_vouchers_storage.sql` — bucket privado + RLS

```sql
-- Bucket PRIVADO: el voucher contiene nombre, monto y nº de operación.
-- file_size_limit y allowed_mime_types son la primera barrera (el servidor de
-- Storage las hace cumplir aunque alguien salte la UI).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('payment-vouchers', 'payment-vouchers', false, 5242880,
        array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Extrae el order_id de una ruta con el ÚNICO formato válido
-- ('<uuid>/voucher.jpg'); cualquier otra cosa devuelve NULL. Se usa en vez de
-- (storage.foldername(name))[1]::uuid porque un cast fallido dentro de una
-- policy lanza error en vez de "denegar", y el orden de evaluación de un AND
-- en SQL no está garantizado.
create or replace function public.voucher_order_id(p_name text)
returns uuid
language sql
immutable
as $$
  select case
    when p_name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/voucher\.jpg$'
    then split_part(p_name, '/', 1)::uuid
  end
$$;

-- Pedidos del cliente actual que están esperando su pago. SECURITY DEFINER,
-- mismo patrón que current_customer_order_ids() (evita recursión de RLS).
create or replace function public.customer_awaiting_payment_order_ids()
returns setof uuid
language sql
security definer
set search_path = public
stable
as $$
  select id from public.orders
  where customer_id = public.current_profile_id()
    and status = 'AWAITING_PAYMENT'
$$;

-- SUBIR / REEMPLAZAR: solo el cliente dueño, solo mientras el pedido espera el
-- pago. Una vez confirmado (ASSIGNED) el comprobante queda inmutable: nadie
-- puede cambiarlo a posteriori.
create policy "payment_vouchers_insert_customer"
on storage.objects for insert
with check (
  bucket_id = 'payment-vouchers'
  and public.voucher_order_id(name) in (select public.customer_awaiting_payment_order_ids())
);

create policy "payment_vouchers_update_customer"   -- necesaria para upsert (reintentos)
on storage.objects for update
using (
  bucket_id = 'payment-vouchers'
  and public.voucher_order_id(name) in (select public.customer_awaiting_payment_order_ids())
)
with check (
  bucket_id = 'payment-vouchers'
  and public.voucher_order_id(name) in (select public.customer_awaiting_payment_order_ids())
);

-- LEER: el cliente dueño, el repartidor asignado a ESE pedido y el admin.
-- Nadie más (ni otros repartidores, ni otros clientes).
create policy "payment_vouchers_select_parties"
on storage.objects for select
using (
  bucket_id = 'payment-vouchers'
  and (
    public.voucher_order_id(name) in (select public.current_customer_order_ids())
    or public.voucher_order_id(name) in (select public.current_delivery_order_ids())
    or public.current_role() = 'ADMIN'
  )
);

-- Sin policy de DELETE para usuarios: el borrado lo hace el servidor con
-- service_role vía la API de Storage (Fase 6).
```

> **Por qué no `delete from storage.objects` desde SQL para limpiar:** Supabase advierte que borrar filas directamente no elimina el archivo físico. La limpieza va siempre por la API de Storage (`remove`).

### 2.2 — `20260930100100_deliveries_payment_voucher.sql` — dónde se guarda la ruta

```sql
alter table public.deliveries
  add column if not exists payment_voucher_path text;

-- Invariante de datos: la ruta guardada SOLO puede ser la del propio pedido.
alter table public.deliveries
  drop constraint if exists deliveries_voucher_path_check;
alter table public.deliveries
  add constraint deliveries_voucher_path_check
  check (payment_voucher_path is null
         or payment_voucher_path = order_id::text || '/voucher.jpg');

comment on column public.deliveries.payment_voucher_path is
  'Ruta en el bucket privado payment-vouchers del comprobante de Yape que el cliente adjuntó al confirmar el pago. NULL en entregas anteriores a este cambio (no se puede inventar un comprobante retroactivo).';
```

Va en `deliveries` (no en `orders`) porque es el comprobante **del pago del envío**, dato del mismo ciclo que `delivery_fee` y `payment_confirmed_at`. Sin backfill: `NULL` es lo correcto para pagos previos.

### 2.3 — `20260930100200_delivery_offer_details.sql` — teléfono en la oferta

`get_delivery_offer_profile` devuelve `(full_name, avatar_url, yape_qr_url, delivery_fee)`. **Cambiar las columnas de retorno de una función exige `DROP` + `CREATE`**, y eso rompería el código desplegado durante la ventana de migración. Por eso se crea una función **nueva** y la vieja convive hasta la Fase 9.

```sql
create or replace function public.get_delivery_offer_details(p_order_id uuid)
returns table (
  full_name text,
  avatar_url text,
  yape_qr_url text,
  phone text,
  delivery_fee numeric,
  payment_voucher_path text
)
language sql
security definer
set search_path = public
stable
as $$
  select p.full_name, p.avatar_url, p.yape_qr_url, p.phone,
         d.delivery_fee, d.payment_voucher_path
  from public.orders o
  join public.deliveries d on d.order_id = o.id
  join public.profiles p on p.id = d.delivery_person_id
  where o.id = p_order_id
    and o.customer_id = public.current_profile_id()
    -- Minimización de datos (Ley 29733): el celular del repartidor solo es
    -- visible mientras el pedido está vivo. Cancelado / entregado / de vuelta
    -- en PENDING → cero filas.
    and o.status in ('AWAITING_PAYMENT', 'ASSIGNED', 'PICKED_UP', 'ON_THE_WAY')
$$;

revoke all on function public.get_delivery_offer_details(uuid) from public, anon;
grant execute on function public.get_delivery_offer_details(uuid) to authenticated;
```

Sigue la regla que ya rige el proyecto: el cliente **no** recibe una policy de `SELECT` sobre `profiles` (entregaría también `document_number` y `email`); recibe exactamente los seis campos que necesita, y solo de su propio pedido.

### 2.4 — `20260930100300_confirm_delivery_payment_voucher.sql` — la confirmación exige el voucher

Nueva sobrecarga `confirm_delivery_payment(uuid, text)`. Se conserva el cuerpo vigente (orden de validaciones, `errcode`, bloqueo `FOR UPDATE OF o`, guarda de idempotencia, `if not found` tras cada update) y se agregan **tres cambios**:

```sql
create or replace function public.confirm_delivery_payment(p_order_id uuid, p_voucher_path text)
returns void language plpgsql security definer set search_path = public as $$
declare /* ...mismas variables que la versión actual... */
begin
  /* ...identidad, existencia, dueño, idempotencia, estado, repartidor y tarifa:
     IDÉNTICO a la versión vigente y en el mismo orden... */

  -- (1) El comprobante es obligatorio y solo puede ser el de ESTE pedido.
  if p_voucher_path is distinct from p_order_id::text || '/voucher.jpg' then
    raise exception 'Adjunta el comprobante de tu pago para confirmar'
      using errcode = '22000';
  end if;

  -- (2) Y tiene que existir de verdad en Storage: evita confirmar apuntando a
  --     un archivo que nunca se subió (o que falló a mitad de camino).
  if not exists (
    select 1 from storage.objects
    where bucket_id = 'payment-vouchers' and name = p_voucher_path
  ) then
    raise exception 'No encontramos tu comprobante. Vuelve a subirlo e inténtalo de nuevo'
      using errcode = '22000';
  end if;

  -- (3) Se guarda junto con la confirmación, en la MISMA transacción.
  update public.deliveries
  set payment_confirmed_at = now(),
      accepted_at = now(),
      payment_voucher_path = p_voucher_path
  where id = v_delivery_id and payment_confirmed_at is null;
  /* ...resto igual (if not found, update de orders, if not found)... */
end; $$;

revoke all on function public.confirm_delivery_payment(uuid, text) from public, anon;
grant execute on function public.confirm_delivery_payment(uuid, text) to authenticated;
```

> Mientras la versión de una sola argumento siga existiendo, **permite confirmar sin voucher** (D1 no se cumple). Es una ventana intencional y corta: se cierra con la migración de la Fase 9.3.

### 2.5 — Criterios de aceptación de la Fase 2

- [ ] Un cliente puede subir `{su_pedido}/voucher.jpg` solo si el pedido está `AWAITING_PAYMENT`; en `PENDING`, `ASSIGNED` o `CANCELLED` → `403`.
- [ ] Un cliente **no** puede subir/leer en la carpeta de un pedido ajeno.
- [ ] Un archivo con nombre distinto a `voucher.jpg`, o de tipo `image/gif`, o de > 5 MB → rechazado por el bucket.
- [ ] El repartidor asignado puede **leer** el voucher; otro repartidor, no. `anon`, no.
- [ ] Tras `ASSIGNED`, el cliente ya no puede sobreescribir el voucher.
- [ ] `get_delivery_offer_details` devuelve el teléfono solo al dueño del pedido y solo en estados vivos.
- [ ] `confirm_delivery_payment(uuid, text)` rechaza: `null`, ruta de otro pedido, ruta sin archivo real; y acepta la ruta válida guardándola en la misma transacción.
- [ ] `anon` → `42501` en las dos funciones nuevas.

---

## Fase 3 — Backend: Server Actions, API v1 y tipos

### 3.1 — `types/database.ts`

- `deliveries` (`Row`/`Insert`/`Update`): `payment_voucher_path: string | null`.
- `Functions`: agregar `get_delivery_offer_details` (con sus 6 columnas) y la sobrecarga `confirm_delivery_payment` con `{ p_order_id: string; p_voucher_path: string }`.
- Constante compartida (evita el string mágico repetido en cliente, servidor y tests):

```ts
// lib/constants/payment-voucher.ts
export const PAYMENT_VOUCHER_BUCKET = 'payment-vouchers'
export const paymentVoucherPath = (orderId: string) => `${orderId}/voucher.jpg`
export const VOUCHER_MAX_SIDE_PX = 1600
export const VOUCHER_MAX_BYTES = 5 * 1024 * 1024
export const VOUCHER_SIGNED_URL_TTL_S = 60 * 60 // 1 h
```

### 3.2 — `lib/actions/orders.ts::confirmDeliveryPayment`

```ts
export async function confirmDeliveryPayment(orderId: string) {
  const supabase = await createClient()
  const { error } = await supabase.rpc('confirm_delivery_payment', {
    p_order_id: orderId,
    p_voucher_path: paymentVoucherPath(orderId),   // el servidor CALCULA la ruta: el cliente no la elige
  })
  if (error) throw new Error(error.message)
  /* revalidatePath igual que hoy */
}
```

El navegador **no** manda la ruta: el servidor la deriva de `orderId`. La función SQL vuelve a validarla (defensa en profundidad) y comprueba que el archivo exista.

### 3.3 — Por qué el archivo se sube desde el navegador y no por Server Action

Las Server Actions tienen un límite de cuerpo de 1 MB por defecto (`serverActions.bodySizeLimit`); un screenshot rara vez cabe, y subir el límite global es una mala idea. Subir **directo del navegador a Storage** (con la sesión del cliente, RLS aplicada) evita pasar el archivo por nuestro servidor, igual que ya se hace con ImageKit.

### 3.4 — API v1: paridad para consumidores externos

`PUT /api/v1/orders/[id]` con `action: 'confirm_payment'` hoy llama la RPC de un solo argumento. Cambia a:

```ts
const { error } = await userClient(request).rpc('confirm_delivery_payment', {
  p_order_id: id,
  p_voucher_path: paymentVoucherPath(id),
})
```

Documentar en el handler que un consumidor de la API debe subir primero su comprobante a `payment-vouchers/{id}/voucher.jpg` con el mismo token Bearer (la RLS es la misma). Los errores de la función ya viajan por `rpcErrorResponse` con su `errcode`.

### 3.5 — Lectura de la oferta en la página (reemplaza la RPC vieja)

```ts
// app/cliente/pedidos/[id]/page.tsx
const { data: offers } = await supabase.rpc('get_delivery_offer_details', { p_order_id: id })
const offer = offers?.[0]
```

Se llama **siempre que el estado sea `AWAITING_PAYMENT`** (para la tarjeta) y **también en estados vivos posteriores** (`ASSIGNED`…`ON_THE_WAY`) para mostrar el comprobante enviado (Fase 5). Con `voucherUrl` firmada del lado del servidor:

```ts
let voucherUrl: string | null = null
if (offer?.payment_voucher_path) {
  const { data } = await supabase.storage
    .from(PAYMENT_VOUCHER_BUCKET)
    .createSignedUrl(offer.payment_voucher_path, VOUCHER_SIGNED_URL_TTL_S)
  voucherUrl = data?.signedUrl ?? null
}
```

Se firma con el cliente del usuario (no service role): si la RLS de lectura no le corresponde, no hay URL. **No** se usa `next/image` con URLs firmadas: el optimizador las cachearía fuera del control de expiración; se usa `<img>` (patrón ya usado en el proyecto con su `eslint-disable`).

### 3.6 — Criterios de aceptación de la Fase 3

- [ ] `pnpm run typecheck` sin errores tras actualizar `database.ts`.
- [ ] La ruta del voucher se calcula en un solo lugar (`paymentVoucherPath`); no hay strings `'/voucher.jpg'` sueltos.
- [ ] `confirm_payment` de la API falla con `400` y mensaje claro si no hay voucher subido.

---

## Fase 4 — UI: rediseño de `DeliveryPaymentCard`

**Archivos:** `components/features/orders/DeliveryPaymentCard.tsx` (reescritura), `components/ui/copy-button.tsx` (nuevo), `components/features/orders/PaymentVoucherPicker.tsx` (nuevo), `lib/images/compress-voucher.ts` (nuevo), `lib/format/phone.ts` (nuevo, 5 líneas).

### 4.1 — Jerarquía de la tarjeta (de arriba abajo)

El cliente tiene **una tarea con tres pasos**; la tarjeta debe decirlo y guiar el orden. Se mantiene el lenguaje ámbar de "esperando algo de alguien".

```
┌──────────────────────────────────────────────┐
│ [foto]  Carlos Ríos llevará tu pedido         │
│         Costo de envío  S/ 7.50   ← dato grande│
├──────────────────────────────────────────────┤
│ 1  Paga por Yape                               │
│    ┌────────────┐                              │
│    │   [ QR ]   │  Toca para ampliarlo         │
│    └────────────┘                              │
│    O a este número                             │
│    987 654 321                        [ ⧉ ]    │  ← Fase 4.2
├──────────────────────────────────────────────┤
│ 2  Adjunta tu comprobante                      │
│    ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐                   │
│    │  📎 Toca para subir     │  (Fase 4.3)      │
│    └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘                   │
├──────────────────────────────────────────────┤
│ 3  [   Ya pagué, confirmar   ]                 │
└──────────────────────────────────────────────┘
```

- **Se elimina** el párrafo *"Escanea el QR y paga S/ … Cuando lo hayas hecho, confirma abajo: no verificamos el pago automáticamente…"* (pedido explícito). Su función informativa pasa a ser el propio orden numerado 1 → 2 → 3, que es más claro que un párrafo.
- El pie del `DialogContent` del QR ampliado (*"Escanéalo y transfiere S/ X por Yape"*) **se conserva**: es otro texto, tiene una función distinta (instruir mientras se ve el QR grande) y el pedido apuntaba solo al párrafo de la tarjeta.
- Los tres pasos son **títulos cortos** (`text-xs font-semibold uppercase tracking-wide text-muted-foreground` con un círculo numerado `h-5 w-5`), no un stepper interactivo: no hay navegación entre pasos, todo está visible a la vez (menos taps, cumple "una acción primaria por pantalla": el CTA sigue siendo el único botón lleno).
- La tarifa sube de `text-xs` a `text-lg font-semibold`: es **el** dato que el cliente necesita para pagar.
- Si el repartidor **no cargó QR**, el paso 1 muestra solo el número (que pasa a ser la vía principal, con más peso) y se conserva el aviso punteado actual adaptado: *"Pídele el pago por el número de abajo"*.
- Si el teléfono es `null` (dato incompleto o cuenta anonimizada), la fila no se renderiza — nunca se muestra un botón de copiar vacío.

### 4.2 — Número del repartidor + botón de copiar

**`lib/format/phone.ts`**

```ts
/** '987654321' → '987 654 321'. Cualquier otro formato se devuelve tal cual. */
export function formatPePhone(raw: string): string {
  const d = raw.replace(/\D/g, '')
  return d.length === 9 ? `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}` : raw
}
```

**`components/ui/copy-button.tsx`** (genérico y reutilizable: mañana sirve para copiar el monto o un código de pedido)

```tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import { CheckIcon, CopyIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import { cn } from '@/lib/utils'

async function writeClipboard(text: string) {
  if (navigator.clipboard?.writeText && window.isSecureContext) {
    await navigator.clipboard.writeText(text)
    return
  }
  // Fallback para contextos no seguros (http en red local durante desarrollo,
  // WebViews antiguos): textarea temporal + execCommand.
  const ta = document.createElement('textarea')
  ta.value = text
  ta.setAttribute('readonly', '')
  ta.style.position = 'fixed'
  ta.style.opacity = '0'
  document.body.appendChild(ta)
  ta.select()
  const ok = document.execCommand('copy')
  document.body.removeChild(ta)
  if (!ok) throw new Error('copy failed')
}

export function CopyButton({ value, label, className }: { value: string; label: string; className?: string }) {
  const [copied, setCopied] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const { error } = useToast()

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])

  async function handleCopy() {
    try {
      await writeClipboard(value)
      setCopied(true)
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => setCopied(false), 2000)
    } catch {
      error('No se pudo copiar', 'Mantén presionado el número para copiarlo.')
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={handleCopy}
        aria-label={copied ? `${label} copiado` : `Copiar ${label}`}
        className={cn('h-10 w-10 shrink-0 rounded-xl', copied && 'border-emerald-500/50 text-emerald-700', className)}
      >
        {copied ? <CheckIcon className="h-4 w-4" /> : <CopyIcon className="h-4 w-4" />}
      </Button>
      {/* Anuncio para lectores de pantalla; el cambio de ícono es solo visual. */}
      <span role="status" aria-live="polite" className="sr-only">{copied ? `${label} copiado` : ''}</span>
    </>
  )
}
```

Decisiones de UX:

- **Se copian los 9 dígitos sin espacios** (lo que Yape acepta al pegar), pero se **muestran agrupados** (`987 654 321`) para leerlos y dictarlos. El usuario nunca ve la diferencia.
- Feedback **en el punto exacto donde tocó**: el ícono cambia `Copy → Check` durante 2 s (no depender solo de un toast que puede quedar fuera de la vista en móvil). El toast solo aparece en el **error**.
- Botón de `h-10 w-10` (40×40): objetivo táctil mínimo. El cambio de estado no depende del color (cambia el ícono) — accesible para daltonismo.
- El número es `select-all` (`<span className="select-all tabular-nums">`): si el portapapeles fallara, un toque largo lo selecciona entero.
- Sin animación nueva → no hay nada que sumar a `prefers-reduced-motion`.

Fila en la tarjeta:

```tsx
{deliveryPerson.phone && (
  <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl border border-black/5 bg-white p-3 dark:border-white/10 dark:bg-white/5">
    <div className="min-w-0">
      <p className="text-xs text-muted-foreground">{deliveryPerson.yapeQrUrl ? 'O yapea a este número' : 'Yapea a este número'}</p>
      <p className="select-all text-lg font-semibold tabular-nums tracking-wide">{formatPePhone(deliveryPerson.phone)}</p>
    </div>
    <CopyButton value={deliveryPerson.phone.replace(/\D/g, '')} label="número del repartidor" />
  </div>
)}
```

### 4.3 — Subir el voucher

#### `lib/images/compress-voucher.ts` — re-encodear en el navegador

Por qué comprimir (no es un lujo): una foto de cámara pesa 3–8 MB y en 3G/4G de Abancay eso es la diferencia entre 2 s y 20 s de espera con el botón bloqueado. Además normaliza a JPEG (D4) y corrige la orientación EXIF (una foto vertical no llega girada).

```ts
export async function toVoucherJpeg(file: File, maxSide = 1600, quality = 0.82): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('No se pudo procesar la imagen')
  ctx.fillStyle = '#fff'                       // PNG con transparencia → fondo blanco, no negro
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('No se pudo procesar la imagen'))), 'image/jpeg', quality)
  )
}
```

1600 px de lado mayor deja un screenshot de Yape perfectamente legible (monto y nº de operación) en ~150–300 KB.

#### `PaymentVoucherPicker.tsx` — el control

Componente **controlado** (recibe `file` y `onChange`; no sabe de Supabase): así el padre decide cuándo subir (D2) y el componente es testeable.

Estados a diseñar explícitamente:

| Estado | Qué ve el cliente |
|---|---|
| Vacío | Recuadro punteado, ícono `ImagePlusIcon`, "Toca para subir tu comprobante". `<input type="file" accept="image/*">` dentro del `<label>` (en móvil abre cámara/galería nativa). |
| Con archivo | Miniatura (`URL.createObjectURL`, revocada en cleanup para no filtrar memoria), nombre truncado, peso, botones **Cambiar** y **Quitar** (ambos ≥ 40 px, con `aria-label`). |
| Procesando | Spinner "Preparando imagen…" solo mientras corre la compresión. |
| Error de archivo | Mensaje inline (`role="alert"`) **junto al control**: "Debe ser una imagen (JPG, PNG o WEBP)" / "La imagen no puede pesar más de 20 MB". Nunca un toast que desaparece. |
| Subiendo (lo controla el padre) | Overlay con barra/spinner y el control deshabilitado. |

Validación de entrada: `file.type.startsWith('image/')`; tope de **entrada** generoso (20 MB) porque se va a comprimir; el tope real (5 MB) lo hace cumplir el bucket sobre el resultado.

Drag & drop: se soporta (escritorio) reutilizando la lógica del `ImageUploader` existente, pero **no** se reutiliza ese componente: está atado a ImageKit y al modo público; forzarlo a subir a Storage privado lo volvería una clase con dos personalidades. Se documenta como duplicación consciente y pequeña.

### 4.4 — Flujo del botón "Ya pagué, confirmar"

```tsx
const [file, setFile] = useState<File | null>(null)
const [phase, setPhase] = useState<'idle' | 'preparing' | 'uploading' | 'confirming'>('idle')

async function handleConfirm() {
  if (!file) return
  setPhase('preparing')
  try {
    const blob = await toVoucherJpeg(file)
    setPhase('uploading')
    const supabase = createClient()                       // cliente de navegador, sesión del usuario → RLS
    const { error: upErr } = await supabase.storage
      .from(PAYMENT_VOUCHER_BUCKET)
      .upload(paymentVoucherPath(orderId), blob, { upsert: true, contentType: 'image/jpeg', cacheControl: '0' })
    if (upErr) throw new Error('No se pudo subir el comprobante. Revisa tu conexión e inténtalo de nuevo.')

    setPhase('confirming')
    await confirmDeliveryPayment(orderId)
    success('¡Listo! Tu repartidor ya puede ir por tu pedido.')
    router.refresh()
  } catch (err) {
    error('No se pudo confirmar', err instanceof Error ? err.message : undefined)
  } finally {
    setPhase('idle')        // el archivo se CONSERVA para reintentar sin volver a elegirlo
  }
}
```

- **Botón:** `disabled` mientras no haya archivo o `phase !== 'idle'`. Texto por fase: "Preparando…" → "Subiendo comprobante…" → "Confirmando…". Con el botón deshabilitado por falta de archivo, un texto de ayuda visible (no solo `title`) dice *"Adjunta tu comprobante para confirmar"*: un botón gris sin explicación es un callejón sin salida.
- **Reintento seguro:** `upsert: true` + ruta fija → reintentar tras un corte de red sobreescribe, no duplica. Si el `upload` tuvo éxito y la RPC falló (p. ej. el repartidor retiró su oferta justo entonces), el archivo queda como único huérfano posible del pedido (Fase 6 lo cubre).
- **Si la oferta desapareció durante la operación**, el mensaje de la función SQL llega al toast y, gracias a la Fase 1, la tarjeta se retira sola.
- Cero cambios de estado en el servidor hasta el paso final: si el cliente cierra la pestaña a mitad, no queda nada a medias en la base.

### 4.5 — Criterios de aceptación de la Fase 4

- [ ] El párrafo eliminado no aparece en ninguna parte de la tarjeta (`grep "no verificamos el pago"` → 0 resultados).
- [ ] El número del repartidor se ve agrupado (`987 654 321`); el botón copia `987654321` (verificar pegando en el campo de Yape).
- [ ] Al copiar, el ícono cambia a check ≥ 2 s y un lector de pantalla anuncia "número del repartidor copiado".
- [ ] Sin `navigator.clipboard` (http local) el fallback copia igual; si todo falla, aparece el toast de error y el número sigue seleccionable.
- [ ] Repartidor sin teléfono → no se renderiza la fila ni el botón.
- [ ] Repartidor sin QR → el número pasa a ser la vía principal, sin bloque de QR roto.
- [ ] Sin voucher el botón está deshabilitado y explica por qué.
- [ ] Una foto de 6 MB sube en < 5 s en 4G y pesa < 500 KB en el bucket.
- [ ] Una foto vertical de celular llega derecha (EXIF corregido).
- [ ] Un PNG transparente no queda con fondo negro.
- [ ] Tras un fallo de red a mitad, el archivo elegido sigue ahí y se puede reintentar sin re-seleccionar.

---

## Fase 5 — El comprobante después de confirmar

### 5.1 — Cliente (`/cliente/pedidos/[id]`)

Cuando el pedido ya está `ASSIGNED`/`PICKED_UP`/`ON_THE_WAY` y hay `voucherUrl`, la página muestra una fila compacta dentro del bloque de pago/envío (no una tarjeta nueva, para no repetir el "over-carding" ya diagnosticado en planes anteriores):

- Miniatura 48×48 + "Comprobante enviado" + `Ver` (abre un `Dialog` con la imagen a tamaño completo, `object-contain`, con `alt="Comprobante de pago por Yape"`).
- Es de **solo lectura**: la policy de `update` ya impide reemplazarlo tras `ASSIGNED`.
- Si el pago es anterior a esta feature (`payment_voucher_path` nulo) no se muestra nada; no se inventa un estado.

Además, aquí es donde sí se justifica mostrar **"Tu repartidor"** con nombre y teléfono durante `ASSIGNED…ON_THE_WAY` (la función ya devuelve el teléfono en esos estados); queda como mejora opcional con botón de llamar/WhatsApp — **fuera del alcance mínimo** de este plan.

### 5.2 — Repartidor (`/repartidor/pedidos/[id]`)

El repartidor es quien **necesita** el comprobante (es su evidencia de cobro). En `app/repartidor/pedidos/[id]/page.tsx`:

- Leer `deliveries.payment_voucher_path` (ya entra en el `select` de `deliveries(...)`; agregar la columna).
- Generar la URL firmada con **su** cliente (la policy `payment_vouchers_select_parties` valida que sea el repartidor de ese pedido).
- Mostrar una tarjeta **secundaria** "Comprobante de pago del cliente" con miniatura, monto esperado (`S/ delivery_fee`), hora de confirmación (`payment_confirmed_at`) y botón "Ver en grande". El monto junto a la imagen es lo que le permite **contrastar de un vistazo** que el voucher coincide con lo que cobró.
- En "Mis entregas" (`DeliveryOrdersClient`), para pedidos ya confirmados, un pequeño indicador "Comprobante adjunto" en la tarjeta que enlaza al detalle. Sin cargar la imagen en la lista (una URL firmada por fila sería un costo innecesario).

Cuando el cliente confirma, la lista del repartidor ya se actualiza por el canal `my-deliveries` existente (`orders` UPDATE); no hace falta realtime nuevo.

### 5.3 — Criterios de aceptación de la Fase 5

- [ ] El cliente ve su comprobante tras confirmar y puede ampliarlo; no puede reemplazarlo.
- [ ] El repartidor asignado ve el comprobante con el monto al lado; otro repartidor obtiene `403`/sin imagen al intentar la URL.
- [ ] Una URL firmada caducada (1 h) no rompe la página: al recargar se genera una nueva.
- [ ] Pedidos anteriores a esta feature no muestran ningún bloque vacío ni error.

---

## Fase 6 — Ciclo de vida, limpieza y privacidad (Ley 29733)

Un comprobante de Yape es un dato financiero personal. Lo mismo que ya se hizo con la foto y el QR del repartidor (limpiar ImageKit al anonimizar) aplica aquí, y **debe salir en el mismo release** que la subida (regla del proyecto: nunca desplegar la captura de un dato personal sin su limpieza).

### 6.1 — Helper `lib/storage/payment-vouchers.ts`

```ts
// Solo servidor. service_role: no hay policy de DELETE para usuarios a propósito.
export async function removePaymentVouchers(client: AdminClient, orderIds: string[]) {
  if (orderIds.length === 0) return
  const { error } = await client.storage
    .from(PAYMENT_VOUCHER_BUCKET)
    .remove(orderIds.map(paymentVoucherPath))
  // "Mejor esfuerzo", igual que deleteImageKitFileSafe: un fallo de Storage no
  // debe romper la operación de negocio que ya se ejecutó.
  if (error) console.error('[vouchers] no se pudieron borrar:', error.message)
}
```

### 6.2 — Dónde se invoca

| Evento | Acción | Motivo |
|---|---|---|
| `cancelOrder()` (cliente cancela en `AWAITING_PAYMENT`) | Borrar el voucher del pedido, **solo si `payment_voucher_path IS NULL`** (aún no confirmado) | Cubre el huérfano del caso "subió y la RPC falló". La guarda evita borrar el comprobante de un pago ya confirmado. |
| Oferta retirada / expirada (`retract_delivery_offer`, `expire_stale_delivery_offers`) | Borrado best-effort tras la operación (en la Server Action de retirar; en el job de expiración, una pasada de limpieza por los pedidos devueltos a `PENDING`) | Mismo huérfano. |
| `anonymizeProfile()` de un **CUSTOMER** | Listar sus pedidos (`orders.customer_id`) y borrar todos sus vouchers **antes** de anonimizar | El voucher identifica al cliente; nombre + monto + nº de operación. El registro de la transacción (monto, fechas, snapshots) se conserva; la imagen no. |
| Hard-delete de cliente sin historial | Nada que hacer (sin pedidos no hay vouchers) | — |

`removeOrderVouchers` se orquesta con el mismo orden defensivo de `anonymize-profile.ts`: **leer rutas → anonimizar → borrar archivos**, de modo que si el borrado falla, queda un archivo huérfano (modo de fallo aceptable) y nunca una cuenta a medio anonimizar.

### 6.3 — Retención (decisión pendiente, con recomendación)

El voucher es evidencia entre dos particulares (cliente ↔ repartidor); la plataforma no cobra ese dinero. Recomendación: **purgar los vouchers 90 días después de `DELIVERED`** con una función SQL + job (mismo patrón que `expire_stale_delivery_offers`, que ya se dejó como función invocable desde un cron externo). Plazo definitivo a confirmar con el contador/asesor legal junto con el plazo de 5 años ya publicado para la transacción. **No bloquea este release**, pero se documenta como deuda explícita.

### 6.4 — Política de Privacidad (`app/(public)/privacidad/page.tsx`)

- Sección 2 ("Datos que recopilamos"): nueva viñeta *"Comprobantes de pago: imagen del comprobante de Yape que adjuntas al confirmar el pago del envío."*
- Sección 3 (finalidad): que se comparte **únicamente con el repartidor asignado a tu pedido** como constancia del pago.
- Sección 5 (encargados): Supabase ya figura; no cambia.
- Sección 6 (conservación): al anonimizar la cuenta, el comprobante se elimina; y el plazo de purga posterior a la entrega (cuando se defina 6.3).
- **Subir `UPDATED_AT`** a la fecha del release (la sección 10 se compromete a publicar cada cambio con su fecha; una categoría nueva de dato es un cambio material).

### 6.5 — Criterios de aceptación de la Fase 6

- [ ] Cancelar en `AWAITING_PAYMENT` tras un intento fallido de confirmación deja el bucket sin archivo de ese pedido.
- [ ] Nunca se borra el voucher de un pedido con `payment_confirmed_at`.
- [ ] Anonimizar un cliente con pedidos borra todos sus vouchers del bucket (verificar en el dashboard de Storage).
- [ ] La política de privacidad menciona los comprobantes y tiene fecha nueva.

---

## Fase 7 — Accesibilidad, motion y responsive (no negociable)

1. **Contraste (medir, no estimar):** número del repartidor (`text-lg font-semibold` sobre `bg-white` y `bg-white/5` en oscuro), textos `text-xs text-muted-foreground` sobre el fondo ámbar de la tarjeta (`amber-50/60` → recordar que el proyecto ya corrigió textos `amber-600` a `amber-700` por dar 3.11:1), estado `copied` en `emerald-700`.
2. **Foco:** el `:focus-visible` lima global cubre los controles nuevos; ninguno usa `outline-none`. Orden de tabulación lógico: QR → copiar → subir comprobante → cambiar/quitar → confirmar.
3. **Objetivo táctil:** copiar 40×40, cambiar/quitar 40×40, confirmar `h-10` a ancho completo.
4. **Lector de pantalla:** región `aria-live` del copiado (4.2) y del estado del pedido (1.3); errores de archivo con `role="alert"`; miniatura del voucher con `alt` descriptivo; el `<input type="file">` visible para tecnología asistiva dentro de su `<label>` (no `display:none`).
5. **`prefers-reduced-motion`:** no se agregan animaciones nuevas salvo `animate-fade-up` de la tarjeta (ya cubierta por la regla global); el spinner de subida es `animate-spin` (ya cubierto).
6. **No depender del color:** el copiado cambia de ícono; el error de archivo lleva texto; el botón deshabilitado explica su causa.
7. **Responsive:** 360 px (el caso real de la mayoría de clientes): el número + botón no desbordan (`min-w-0` + `truncate` solo en nombre, nunca en el número); el QR de 160 px y el recuadro de subida caben sin scroll horizontal; con teclado abierto no hay campos de texto en la tarjeta, así que no hay riesgo de tapar el CTA.
8. **Conexiones lentas:** el estado "Subiendo comprobante…" debe verse de inmediato; la compresión evita el peor caso. Probar con *Slow 3G* en DevTools.

---

## Fase 8 — QA

### 8.1 — Actualizar y extender la suite E2E (`scripts/e2e-delivery-offer.mjs`)

Los scripts viven en `/scripts` (ignorado por git; herramientas locales). El existente **rompe** con este cambio porque llama a `confirm_payment` sin comprobante; actualizarlo es parte de la tarea, no un extra. Casos nuevos:

- Confirmar sin voucher → `400` "Adjunta el comprobante…".
- Confirmar con archivo inexistente → `400` "No encontramos tu comprobante…".
- Subir voucher: cliente dueño en `AWAITING_PAYMENT` → OK; en `PENDING` → `403`; cliente ajeno → `403`; nombre de archivo distinto → `403`; `image/gif` → rechazado; > 5 MB → rechazado.
- Leer voucher: cliente dueño OK; repartidor asignado OK; otro repartidor `403`; `anon` `403`.
- Tras `ASSIGNED`: el cliente no puede sobreescribir (`403`).
- `get_delivery_offer_details`: dueño → 6 campos con `phone`; otro cliente → 0 filas; pedido `CANCELLED`/`PENDING` → 0 filas; `anon` → `42501`.
- Confirmar guarda `payment_voucher_path` y la CHECK rechaza una ruta de otro pedido (`23514`).
- Doble confirmación → sigue dando `409 ya fue confirmado`.

### 8.2 — Checklist manual (necesita pantalla / dos sesiones)

- [ ] **Tiempo real (el bug):** navegador A (cliente) con el pedido abierto en `PENDING`; navegador B (repartidor) envía la oferta → en A aparece la tarjeta con foto, QR, número y tarifa en < 1 s, con el aviso.
- [ ] Retirar la oferta en B → la tarjeta desaparece en A.
- [ ] A en segundo plano 1 min, B ofertó en el medio → al volver a A, la tarjeta está.
- [ ] El texto eliminado no se ve en ningún estado de la tarjeta.
- [ ] Copiar el número y pegarlo en Yape (dispositivo real Android e iOS).
- [ ] Subir: screenshot de Yape, foto de cámara vertical, PNG grande, archivo no imagen (rechazo con mensaje), imagen > 20 MB (rechazo).
- [ ] Cortar la red al pulsar confirmar → mensaje claro, archivo conservado, reintento OK.
- [ ] Tras confirmar: el cliente ve "Comprobante enviado"; el repartidor lo ve en su detalle con el monto.
- [ ] Repartidor sin QR / sin teléfono → degradación sin elementos rotos.
- [ ] Cancelar en `AWAITING_PAYMENT` → sin archivo huérfano en el bucket.
- [ ] Anonimizar un cliente → vouchers borrados.
- [ ] Modo oscuro, 360 px, `prefers-reduced-motion`, lector de pantalla (TalkBack/VoiceOver) en el flujo completo.
- [ ] Regresión: admin y restaurante (`RealtimeRefresh` con sus defaults) siguen refrescando como antes.
- [ ] `pnpm run typecheck`, `pnpm run lint`, `pnpm run build` en verde.

---

## Fase 9 — Orden de despliegue y rollback

El orden importa porque **dos funciones cambian de firma** y hay código en producción que llama a las viejas.

| # | Paso | Por qué en este orden |
|---|---|---|
| 1 | **Desplegar la Fase 1** (tiempo real) sola | Sin dependencias de base de datos; resuelve el bug hoy. |
| 2 | Migraciones 2.1 → 2.4 (`supabase db push`) | Solo **agregan**: bucket, columna, función nueva de lectura y sobrecarga nueva de confirmación. La app vieja sigue funcionando con las funciones viejas, que aún existen. |
| 3 | Actualizar `types/database.ts` en el mismo commit que el código | Los tipos deben coincidir con lo ya aplicado. |
| 4 | **Desplegar Fases 3–6 juntas** (backend + UI + limpieza + privacidad) | La captura del dato (5.x) y su limpieza (6.x) **no se separan**: sería el mismo daño irreversible que ya documenta el proyecto para las fotos de perfil (archivos personales sin forma de limpiarlos después). |
| 5 | Checklist de la Fase 8 con dos sesiones y un celular real | Verificación de extremo a extremo. |
| 6 | **Migración de cierre `…100400_drop_legacy_offer_functions.sql`**: `drop function confirm_delivery_payment(uuid)` y `drop function get_delivery_offer_profile(uuid)` | Recién ahora que ningún código las llama. Cierra la ventana en la que se podía confirmar sin comprobante (D1) y elimina la función de lectura sin teléfono. |

**Rollback**
- Fase 1: revert de código, sin efectos en datos.
- Fases 3–6: revert de código es seguro (columna y bucket quedan sin uso). **No** hacer `drop column` ni borrar el bucket si ya hay comprobantes: se perderían archivos personales sin control ni trazabilidad.
- Si se revierte **después** del paso 6, hay que recrear la función vieja de un argumento (script de rollback en el mismo PR de la migración de cierre).

---

## Resumen de archivos

### Nuevos
- `supabase/migrations/20260930100000_payment_vouchers_storage.sql`
- `supabase/migrations/20260930100100_deliveries_payment_voucher.sql`
- `supabase/migrations/20260930100200_delivery_offer_details.sql`
- `supabase/migrations/20260930100300_confirm_delivery_payment_voucher.sql`
- `supabase/migrations/20260930100400_drop_legacy_offer_functions.sql` *(solo tras el paso 5 del despliegue)*
- `lib/constants/payment-voucher.ts`
- `lib/format/phone.ts`
- `lib/images/compress-voucher.ts`
- `lib/storage/payment-vouchers.ts`
- `components/ui/copy-button.tsx`
- `components/features/orders/PaymentVoucherPicker.tsx`
- `components/features/orders/OrderStatusAnnouncer.tsx`

### Modificados
- `components/ui/realtime-refresh.tsx` — `syncOnSubscribe`, `refreshOnFocus` (Fase 1)
- `components/features/orders/OrderStatusSection.tsx` — estado derivado de la prop, sin canal propio (Fase 1)
- `app/cliente/pedidos/[id]/page.tsx` — `RealtimeRefresh`, `get_delivery_offer_details`, URL firmada, fila de comprobante (Fases 1, 3, 5)
- `components/features/orders/DeliveryPaymentCard.tsx` — reescritura (Fase 4)
- `lib/actions/orders.ts` — `confirmDeliveryPayment` con ruta derivada; `cancelOrder` con limpieza (Fases 3, 6)
- `lib/actions/deliveries.ts` — limpieza al retirar oferta (Fase 6)
- `app/api/v1/orders/[id]/route.ts` — `confirm_payment` con `p_voucher_path` (Fase 3)
- `lib/admin/anonymize-profile.ts` — borrado de vouchers del cliente (Fase 6)
- `app/repartidor/pedidos/[id]/page.tsx`, `components/features/deliveries/DeliveryOrdersClient.tsx` — comprobante visible para el repartidor (Fase 5)
- `types/database.ts`
- `app/(public)/privacidad/page.tsx`
- `docs/decisions-and-learnings.md` — registrar D1–D5 y la lección de "estado derivado copiado a estado local" (Fase 1)
- `scripts/e2e-delivery-offer.mjs` *(local, no versionado)*

### Fuera de alcance (documentado a propósito)
- Tarjeta "Tu repartidor" con llamar/WhatsApp tras el pago (5.1, opcional).
- Varios comprobantes por pedido (requiere tabla propia).
- Purga automática por antigüedad (6.3, pendiente de definir plazo).
- Verificación automática del pago: no existe pasarela; el voucher da **evidencia**, no **verificación**. Conviene no prometer en la UI más de lo que se hace.
