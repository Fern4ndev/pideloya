# Plan de Implementación — Tarifa de Envío 100% Libre del Repartidor + Pulido Integral del Panel de Cliente

**Proyecto:** PideloYa
**Autor del plan:** Revisión técnica estilo senior (+20 años), sobre el código real del repo.
**Alcance:** (1) Eliminar el cálculo de tarifa sugerida por distancia (Haversine) del flujo de oferta de envío — el repartidor ve la dirección y pone el precio que quiera, sin ninguna sugerencia algorítmica. (2) Pulido visual integral del panel de cliente (`/cliente/**`), con foco especial en la página de detalle de un pedido, la jerarquía y el espaciado de las tarjetas, y la consistencia entre todas las pantallas del panel — aplicando las heurísticas de `ui-ux-pro-max` (jerarquía visual clara, tokens reutilizables en vez de valores mágicos, un acento por función, estados vacíos/carga tratados como parte del diseño, accesibilidad).

> **Nota sobre la skill solicitada (`ui-ux-pro-max`):** no tengo acceso al `SKILL.md` de esa skill en este entorno (vive fuera del sandbox). Este plan aplica los mismos principios que esa skill normalmente encapsula — y que el propio proyecto ya usó explícitamente en `docs/plans/plan-mejora-ui-panel-cliente.md` citando la misma skill: un acento de color por función, jerarquía tipográfica con `line-height`/tamaño deliberados, tokens de sombra/radio/espaciado centralizados en vez de valores repetidos, estados vacíos y de carga como parte del diseño (no un afterthought), objetivo táctil ≥40×40px, contraste medido (no estimado) y `prefers-reduced-motion` respetado. Cada fase cita el principio concreto que aplica.

---

## Índice de fases

| Fase | Nombre | Tipo | Prioridad |
|---|---|---|---|
| 0 | Diagnóstico del estado actual | Lectura | — |
| 1 | Quitar el cálculo de tarifa por distancia | Backend + Frontend | Alta |
| 2 | Fundamentos: sistema de espaciado y layout del panel de cliente | Base (bloquea 3-4) | Alta |
| 3 | Rediseño de la página de detalle de pedido | UI | Alta |
| 4 | Auditoría y pulido de tarjetas transversal (home, lista de pedidos, direcciones, carrito) | UI | Alta |
| 5 | Accesibilidad, responsive y `prefers-reduced-motion` | QA (no negociable) | Alta |
| 6 | QA final, checklist de regresión y orden de despliegue | Obligatoria | — |

Orden recomendado: **1 → 2 → 3 → 4 → 5 → 6**. La Fase 1 es independiente y de bajísimo riesgo — puede desplegarse sola antes que el resto. La Fase 2 bloquea a la 3 y la 4 porque define los tokens de espaciado que ambas consumen. La Fase 5 corre en paralelo a cada fase visual como criterio de aceptación, no como un paso separado al final.

---

## Fase 0 — Diagnóstico del estado actual

Verificado contra el código real del repo, para que el resto del plan parta de hechos y no de suposiciones:

### 0.1 — Cómo funciona hoy la tarifa de envío

El flujo de "oferta de envío" (documentado en `docs/plans/plan-flujo-pago-envio-repartidor.md` y ya implementado) es **casi** exactamente lo que se pide: el pedido nace `PENDING`, el repartidor lo ve en "Disponibles" con la dirección de entrega completa (policy `addresses_select_pending_delivery`), propone una tarifa con `SendOfferForm`, el pedido pasa a `AWAITING_PAYMENT`, el cliente ve la tarjeta de pago (`DeliveryPaymentCard`) con el nombre/foto/QR del repartidor y la tarifa, y al confirmar el pago el pedido pasa a `ASSIGNED`.

Lo único que sobra, y que este plan quita, es la **sugerencia algorítmica** de tarifa:

- `lib/geo/distance.ts` — calcula la distancia en línea recta (Haversine) entre el restaurante y la dirección de entrega.
- `lib/validations/delivery-offer.ts::suggestedDeliveryFee(distanceKm)` — convierte esa distancia en una tarifa sugerida (S/ 1.50/km, piso S/ 5, techo S/ 30).
- `components/features/deliveries/AvailableOrdersClient.tsx` — calcula `distanceKm` con `haversineDistanceKm(...)` a partir de `restaurant.latitude/longitude` y `order.addresses.latitude/longitude`, y se lo pasa a `SendOfferForm`.
- `components/features/deliveries/SendOfferForm.tsx` — usa `distanceKm` para (a) precargar el input con `suggestedDeliveryFee(distanceKm)` en vez de un valor fijo, y (b) mostrar `≈ 2.3 km` junto al label "Tarifa de envío".

Nada de esto vive en la base de datos ni en las funciones SQL (`offer_delivery`, `confirm_delivery_payment`, etc.) — son puramente de UI/cálculo en el cliente. Esto es una buena noticia: **la Fase 1 no toca ninguna migración**, solo simplifica componentes de React y borra un helper que deja de tener consumidores.

### 0.2 — Qué no cambia (y por qué)

- **`deliveryOfferSchema` (Zod, S/ 1 – S/ 30) y el `CHECK` de base de datos (`delivery_fee > 0`) se mantienen intactos.** El pedido es quitar la *sugerencia por distancia*, no el rango de validación del producto — sin un rango razonable, un repartidor podría poner S/ 0.01 o S/ 500 por error de tecleo, y eso sigue siendo una protección de UX/negocio válida sin relación con la distancia.
- **La visibilidad de la dirección completa al repartidor (`pending_order_address_ids()`) se mantiene.** Es justamente la pieza que permite que "el delivery ponga su precio cuando ve la dirección" — ya está resuelta y es la base del flujo pedido.
- **`get_delivery_offer_profile`, `confirm_delivery_payment`, `retract_delivery_offer`, `expire_stale_delivery_offers` no cambian.** Ninguna depende de la distancia.

### 0.3 — Estado actual de la página de detalle de pedido (lo que se pule en la Fase 3)

`app/cliente/pedidos/[id]/page.tsx` hoy apila, en una sola columna y sin agrupación visual consistente:
1. Título + hora (texto plano, sin tarjeta).
2. `OrderStatusSection` (timeline, en tarjeta).
3. `DeliveryPaymentCard` (condicional, en tarjeta ámbar).
4. Lista de productos — cada ítem es su propia tarjeta suelta (`space-y-2.5` de tarjetas individuales, no una sola tarjeta contenedora).
5. Tarjeta de total (Subtotal/Envío/Total).
6. Tarjeta de dirección de entrega.
7. Tarjeta de notas (solo si existen).

Problemas concretos, no de gusto sino de jerarquía:
- **Seis-siete bloques de "tarjeta" del mismo peso visual** (mismo radio, misma sombra `shadow-client-card`, mismo fondo `bg-white/70`) compitiendo por atención — no hay una jerarquía primaria/secundaria clara. El ojo no sabe qué mirar primero.
- **Cada producto es una tarjeta separada** en vez de filas dentro de una sola tarjeta "Productos": con 4-5 ítems, la página se vuelve una columna larga de recuadros redondeados repetidos, visualmente ruidosa (mismo problema que `ui-ux-pro-max` marca como "over-carding": envolver todo en tarjetas en vez de usar la jerarquía tipográfica y el espaciado para agrupar).
- **Dirección y notas son dos tarjetas casi idénticas** (mismo layout: ícono + título + texto) que podrían ser una sola sección "Detalles de la entrega".
- **No hay una jerarquía de "lo más importante arriba"**: el total (el dato que el cliente más probablemente vino a verificar cuando el pedido está en curso) queda a la mitad de la página, después de la lista completa de productos, en vez de estar cerca del estado o fijado.
- **En desktop, todo el contenido usa `max-w-lg` centrado** — se ve como una vista de móvil estirada, sin aprovechar el ancho disponible ni separar "seguimiento" de "detalle del pedido" en columnas, que es el patrón estándar de cualquier página de "estado de pedido" (Amazon, Uber Eats, Rappi): timeline/estado a la izquierda, resumen fijo a la derecha.

### 0.4 — Estado actual del resto del panel (lo que se audita en la Fase 4)

- `OrdersListClient` (lista de pedidos): tarjetas ya con buen tratamiento (`rounded-3xl`, `shadow-client-card`), pero el `space-y-3` entre tarjetas y el `space-y-5` entre grupos de día no sigue ninguna escala documentada — es el mismo problema de "valores mágicos repetidos" que ya se resolvió una vez para sombras (Fase 0 de `plan-mejora-ui-panel-cliente.md`) pero nunca para espaciado.
- `ClienteHomeClient`: buena jerarquía en general (hero, categorías, populares, restaurantes), pero los `gap`/`mt`/`space-y` entre secciones son valores sueltos (`space-y-10`, `mb-3`, `mt-4`, `mt-8`) sin relación documentada entre sí.
- `AddressCard`, `CartClient`: ya usan el token `shadow-client-card`, correcto — pero sus paddings internos (`p-5`, `p-3.5`, `p-4`) varían sin un criterio de "tarjeta primaria vs. tarjeta secundaria".
- No existe hoy un componente de layout compartido para las páginas internas del panel de cliente (cada página define su propio `<div>` contenedor con su propio ancho máximo) — a diferencia de admin/restaurante/repartidor, que sí comparten `PageContainer`/`PageHeader`.

---

## Fase 1 — Quitar el cálculo de tarifa por distancia

**Objetivo:** el repartidor ve la dirección de entrega y escribe el precio que quiera cobrar por el envío, sin ningún número precargado que dependa de la distancia. Punto de partida fijo y simple (S/ 5, ya es el default del producto), completamente editable.

### 1.1 — `lib/validations/delivery-offer.ts`

Quitar `suggestedDeliveryFee()` y su comentario asociado. El archivo queda solo con lo que de verdad es una regla de negocio (rango válido + default):

```ts
import { z } from 'zod'

export const DELIVERY_FEE_MIN = 1
export const DELIVERY_FEE_MAX = 30

/** Tarifa inicial que ve el repartidor al abrir el formulario de oferta.
 * Punto de partida fijo — no depende de la distancia — y el repartidor lo
 * cambia libremente antes de enviar la oferta. */
export const DEFAULT_DELIVERY_FEE = 5

export const deliveryOfferSchema = z.object({
  deliveryFee: z.coerce
    .number()
    .min(DELIVERY_FEE_MIN, `La tarifa mínima es S/ ${DELIVERY_FEE_MIN}`)
    .max(DELIVERY_FEE_MAX, `La tarifa máxima es S/ ${DELIVERY_FEE_MAX}`),
})

export type DeliveryOfferInput = z.infer<typeof deliveryOfferSchema>
```

### 1.2 — Eliminar `lib/geo/distance.ts`

Sin consumidores después de 1.3 y 1.4, el archivo queda muerto. Se borra por completo (`haversineDistanceKm`, `formatDistanceKm`, el comentario que documenta la fórmula) — dejar código sin usar es peor que borrarlo y recuperarlo de git si algún día vuelve a hacer falta.

### 1.3 — `components/features/deliveries/SendOfferForm.tsx`

Simplifica el componente: quita la prop `distanceKm`, el cálculo del valor inicial basado en distancia, y el texto `≈ 2.3 km` junto al label.

```tsx
'use client'

import { useId, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { sendDeliveryOffer } from '@/lib/actions/deliveries'
import { DEFAULT_DELIVERY_FEE } from '@/lib/validations/delivery-offer'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/toast'

/**
 * Oferta de envío: el repartidor ve la dirección de entrega (en la tarjeta
 * del pedido, arriba de este formulario) y propone libremente cuánto cobra
 * por llevarlo — sin ninguna sugerencia automática. El input arranca en
 * DEFAULT_DELIVERY_FEE (S/ 5) como punto de partida neutral, no como
 * recomendación: el repartidor lo cambia con dos toques según su propio
 * criterio (tráfico, hora, cuán conocida es la zona, etc.).
 */
export function SendOfferForm({ orderId }: { orderId: string }) {
  const inputId = useId()
  const router = useRouter()
  const [fee, setFee] = useState(String(DEFAULT_DELIVERY_FEE))
  const [isPending, startTransition] = useTransition()
  const { error, success } = useToast()

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    startTransition(async () => {
      try {
        await sendDeliveryOffer(orderId, { deliveryFee: Number(fee) })
        success('Oferta enviada', 'Te avisaremos cuando el cliente confirme el pago.')
        router.push('/repartidor/pedidos')
      } catch (err) {
        error('No se pudo enviar la oferta', err instanceof Error ? err.message : undefined)
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-center gap-2">
      <label htmlFor={inputId} className="text-sm text-muted-foreground">
        Tarifa de envío
      </label>
      <div className="relative w-24">
        <span
          aria-hidden
          className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground"
        >
          S/
        </span>
        <Input
          id={inputId}
          type="number"
          inputMode="decimal"
          step="0.5"
          min="1"
          max="30"
          required
          value={fee}
          onChange={(event) => setFee(event.target.value)}
          className="pl-7 tabular-nums"
        />
      </div>
      <Button type="submit" variant="lime" disabled={isPending}>
        {isPending ? 'Enviando…' : 'Enviar oferta'}
      </Button>
    </form>
  )
}
```

### 1.4 — `components/features/deliveries/AvailableOrdersClient.tsx`

Quitar el import de `haversineDistanceKm`, el cálculo de `distanceKm` y el prop `distanceKm={distanceKm}` al montar `SendOfferForm`. El resto del componente (tarjeta con nombre de restaurante, dirección de recojo, dirección de entrega, resumen de ítems) no cambia — la dirección de entrega **se sigue mostrando igual que hoy**, solo deja de venir acompañada de una distancia calculada.

```tsx
<DeliveryOrderCard
  key={order.id}
  restaurantName={item0?.restaurant_name ?? restaurant?.name ?? 'Restaurante'}
  pickupAddress={restaurant?.address_text}
  itemsSummary={itemsSummary}
  deliveryAddress={order.addresses?.address_text}
  total={Number(order.total)}
  footer={<SendOfferForm orderId={order.id} />}
/>
```

### 1.5 — Revisión de consumidores restantes de `restaurants.latitude/longitude` en este flujo

`GET /api/v1/orders` (rol `DELIVERY`, `app/api/v1/orders/route.ts`) hoy trae `latitude, longitude` del restaurante embebido específicamente "para que el panel del repartidor calcule la distancia". Con la Fase 1 esos dos campos dejan de tener consumidor en este flujo — se quitan del `select` para no viajar datos que nadie usa (menos payload, y ningún desarrollador futuro se pregunta "¿para qué está esto aquí?"). El comentario del `select` se actualiza para no mencionar una sugerencia de tarifa que ya no existe.

```ts
// components/features/deliveries — ya NO se usa latitude/longitude del
// restaurante para sugerir tarifa (Fase 1 de
// plan-tarifa-libre-repartidor-y-pulido-panel-cliente.md): el repartidor
// fija su propio precio sin ayuda de ningún cálculo de distancia.
const { data, error } = await client
  .from('orders')
  .select(
    '*, order_items(*, restaurants(name, address_text)), addresses(*), deliveries(*)'
  )
  .in('status', ['PENDING', 'AWAITING_PAYMENT', 'ASSIGNED', 'PICKED_UP', 'ON_THE_WAY'])
  .order('created_at', { ascending: false })
```

`types/order.ts::ApiOrderItem.restaurants` pierde `latitude`/`longitude` de su tipo (quedan `name`, `address_text`).

### 1.6 — Qué **no** se toca en esta fase (documentado a propósito)

- El repartidor sigue pudiendo **editar libremente** la tarifa antes de enviarla (eso ya existía y es justo lo pedido: "el delivery pone su precio").
- `updateDeliveryOffer` (editar la tarifa después de ofertar, antes del pago) sigue **sin implementarse** — fue una decisión consciente y documentada en el plan anterior (`plan-flujo-pago-envio-repartidor.md`, Fase 6, punto 5): el cliente puede estar mirando el QR con un monto ya visto, y cambiarlo a mitad de camino rompe la única garantía del flujo. No hay motivo para revisar esa decisión en este ciclo.
- El texto de ayuda del formulario de retirar oferta (`RetractOfferButton`, que muestra `Estás cobrando S/ X por este envío`) no depende de distancia — no cambia.

### 1.7 — Criterios de aceptación de la Fase 1

- [ ] El repartidor, al abrir "Disponibles", ve el input de tarifa precargado con **S/ 5** sin importar qué tan lejos esté la dirección de entrega.
- [ ] No aparece ningún texto de distancia (`≈ X km`) en ningún punto del flujo de oferta.
- [ ] El repartidor puede escribir cualquier valor entre S/ 1 y S/ 30 y enviarlo con éxito; fuera de ese rango, el mismo mensaje de validación de siempre.
- [ ] La dirección de entrega completa sigue visible en la tarjeta de "Disponibles" (eso no cambia — es la pieza que permite cotizar con criterio propio).
- [ ] `grep -r "haversineDistanceKm\|suggestedDeliveryFee\|distanceKm" --include="*.tsx" --include="*.ts"` no devuelve resultados fuera de este plan (cero referencias huérfanas).
- [ ] `pnpm run typecheck` y `pnpm run lint` sin errores nuevos.
- [ ] `pnpm run build` exitoso.

### 1.8 — Archivos tocados en la Fase 1

**Eliminado:** `lib/geo/distance.ts`.
**Modificados:** `lib/validations/delivery-offer.ts`, `components/features/deliveries/SendOfferForm.tsx`, `components/features/deliveries/AvailableOrdersClient.tsx`, `app/api/v1/orders/route.ts` (select del branch `DELIVERY`), `types/order.ts` (`ApiOrderItem.restaurants`).

---

## Fase 2 — Fundamentos: sistema de espaciado y layout del panel de cliente

**Objetivo:** que exista una única fuente de verdad para el espaciado entre secciones y para el "esqueleto" de una página del panel de cliente, igual que ya existe para sombras/radios/motion (Fase 0 de `plan-mejora-ui-panel-cliente.md`). Sin esto, las Fases 3 y 4 repetirían el mismo problema que resuelven: valores de espaciado improvisados por componente.

### 2.1 — Escala de espaciado entre secciones (documentar, no reinventar Tailwind)

El panel de cliente usa hoy `space-y-3/5/6/8/10` de forma intercambiable sin criterio. Se fija una convención de tres niveles, aplicada de forma consistente en las Fases 3 y 4 (no requiere tokens CSS nuevos — Tailwind ya los tiene, esto es disciplina de uso, documentada como comentario en el propio código de layout, igual que ya se hizo con la convención de motion en `app/globals.css`):

| Nivel | Clase | Uso |
|---|---|---|
| Dentro de una tarjeta (entre su header y su contenido, entre filas de una lista interna) | `space-y-3` / `gap-3` | Elementos que pertenecen al mismo bloque de información |
| Entre tarjetas hermanas dentro de una misma sección (ej. las tarjetas de la página de detalle de pedido) | `space-y-4` / `gap-4` | Bloques relacionados pero independientes |
| Entre secciones grandes de una página (ej. hero → categorías → populares → restaurantes en la home) | `space-y-8` en móvil, `space-y-10` en `sm:` | Cambios de tema dentro de la misma página |

### 2.2 — Nuevo componente compartido: `components/layout/ClientPageContainer.tsx`

> **Archivo nuevo, justificado:** admin/restaurante/repartidor ya comparten `PageContainer`; el panel de cliente nunca tuvo su equivalente porque sus páginas nacieron una por una con contenedores `<div>` sueltos (`max-w-lg`, `max-w-5xl`, sin nombre). Sin este componente, la Fase 3 (que necesita un layout de dos columnas en desktop) tendría que reinventar su propio contenedor y la próxima página del panel volvería a hacer lo mismo a mano.

```tsx
import { cn } from '@/lib/utils'

const MAX_WIDTHS = {
  /** Formularios y detalle enfocado en una sola columna (perfil, dirección). */
  narrow: 'max-w-lg',
  /** Contenido con posible layout de 2 columnas en desktop (detalle de pedido). */
  wide: 'max-w-4xl',
} as const

/**
 * Contenedor estándar de una página del panel de cliente. Mismo propósito
 * que PageContainer (admin/restaurante/repartidor): centraliza el ancho
 * máximo para que las páginas dejen de definir cada una el suyo a mano.
 */
export function ClientPageContainer({
  size = 'narrow',
  className,
  children,
}: {
  size?: keyof typeof MAX_WIDTHS
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={cn('mx-auto w-full', MAX_WIDTHS[size], className)}>
      {children}
    </div>
  )
}
```

### 2.3 — Patrón de "tarjeta primaria vs. secundaria" (documentado, para que la Fase 3 lo use con criterio)

Para resolver el "over-carding" del diagnóstico (0.3), se fija una jerarquía de dos niveles en vez de una sola sombra para todo:

- **Tarjeta primaria** (una por página como máximo — el estado del pedido, el total a pagar): `shadow-client-card`, `bg-white/80`, `p-5`, título con el patrón "punto de color + texto" ya usado en Admin/Restaurante (`<span className="h-2 w-2 rounded-full bg-{color}" /> Texto`).
- **Tarjeta secundaria** (agrupaciones de apoyo — productos, entrega): mismo radio (`rounded-3xl`) pero sin sombra propia, con un borde sutil (`border border-black/5 dark:border-white/10`) y fondo más plano (`bg-white/50`) — se distinguen por estar *dentro* del flujo, no por competir visualmente con la tarjeta primaria.
- **Filas dentro de una tarjeta** (ej. cada producto) nunca vuelven a ser tarjetas propias con su propia sombra — son `<li>`/`<div>` con un separador (`divide-y divide-black/5`) o `gap` simple, exactamente el patrón que ya usa `RestaurantMenuView`/`CartClient` para líneas de producto, pero que la página de detalle de pedido (0.3) no seguía.

### 2.4 — Checklist de aceptación de la Fase 2

- [ ] `ClientPageContainer` existe, se usa en al menos una página antes de cerrar esta fase (se adopta de lleno en la Fase 3) y no rompe ninguna página existente (es aditivo).
- [ ] La convención de espaciado de 2.1 queda documentada como comentario en `ClientPageContainer.tsx` (referencia rápida para quien toque el panel de cliente después).
- [ ] `pnpm run build` sin errores — este es un cambio de infraestructura, invisible por sí solo.

---

## Fase 3 — Rediseño de la página de detalle de pedido

**Archivos a modificar:** `app/cliente/pedidos/[id]/page.tsx`, `components/features/orders/OrderStatusSection.tsx`, `components/features/orders/OrderStatusTimeline.tsx`, `components/features/orders/DeliveryPaymentCard.tsx`.
**Archivo nuevo:** `components/features/orders/OrderSummaryCard.tsx` (consolida productos + total, ver 3.3).

### 3.1 — Estructura objetivo

En vez de seis-siete tarjetas del mismo peso apiladas, la página pasa a tener **una jerarquía de tres niveles**, con layout de dos columnas a partir de `md:`:

```
┌─────────────────────────────────────────────┐
│  Encabezado: "Pedido #XXXXXXXX" + fecha/hora │  ← texto, sin tarjeta (ya no compite)
├───────────────────────┬───────────────────────┤
│ Columna izquierda      │ Columna derecha       │
│ (seguimiento)          │ (resumen — sticky)    │
│                        │                       │
│ ┌────────────────────┐│ ┌───────────────────┐ │
│ │ Estado del pedido   ││ │ Resumen del pedido│ │
│ │ (timeline)          ││ │ (productos + total)│ │
│ │ TARJETA PRIMARIA    ││ │ TARJETA PRIMARIA   │ │
│ └────────────────────┘│ └───────────────────┘ │
│                        │                       │
│ ┌────────────────────┐│                       │
│ │ Pago del envío      ││                       │
│ │ (si AWAITING_PAYMENT)│                      │
│ └────────────────────┘│                       │
│                        │                       │
│ ┌────────────────────┐│                       │
│ │ Entrega             ││                       │
│ │ (dirección + notas) ││                       │
│ │ TARJETA SECUNDARIA  ││                       │
│ └────────────────────┘│                       │
└───────────────────────┴───────────────────────┘
```

En móvil (`<md`), las dos columnas colapsan a una sola, en el orden: Estado → Pago (si aplica) → **Resumen del pedido** → Entrega. El resumen sube de posición en móvil porque ahí no hay una columna fija donde "flote" — se prioriza por importancia en vez de dejarlo al final, corrigiendo el problema #4 del diagnóstico (0.3).

### 3.2 — Encabezado sin tarjeta

Se quita el peso de tarjeta del título — es metadata de contexto, no contenido que compita con el estado del pedido:

```tsx
<div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
  <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
    Pedido #{order.id.slice(0, 8)}
  </h1>
  <p className="text-sm text-muted-foreground">
    {new Date(order.created_at).toLocaleDateString('es-PE', { day: 'numeric', month: 'long' })}
    {' · '}
    {new Date(order.created_at).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}
  </p>
</div>
```

Cambio de contenido deliberado: el título pasa de "Pedido del 27 de septiembre" (fecha, que ya se repite abajo del propio título) a "Pedido #XXXXXXXX" — le da al cliente un identificador corto y estable para referenciar el pedido (ej. al escribir a soporte), algo que hoy no existe en ningún punto de la UI del cliente.

### 3.3 — `OrderSummaryCard` (nuevo): productos + total en una sola tarjeta primaria

> **Por qué un componente nuevo y no seguir editando la página a mano:** hoy la página mezcla, inline, el `.map()` de productos y el bloque de total como dos secciones sueltas con su propio JSX. Extraerlas a un componente con una sola responsabilidad ("esto es el resumen de lo que pediste y cuánto cuesta") es lo que permite que la tarjeta tenga una sola sombra, un solo padding, y una sola cabecera — en vez de dos tarjetas que hoy se ven como si fueran de secciones distintas cuando conceptualmente son la misma cosa ("qué pedí y qué pago").

```tsx
'use client'

import type { ReactNode } from 'react'

export type SummaryItem = {
  productName: string | null
  quantity: number
  unitPrice: number
  imageUrl: string | null
}

export function OrderSummaryCard({
  items,
  subtotal,
  deliveryFee,
  action,
}: {
  items: SummaryItem[]
  subtotal: number
  /** null = "por confirmar" (todavía no hay oferta o no se confirmó el pago). */
  deliveryFee: number | null
  /** Slot para una acción contextual futura (ej. "Repetir pedido") — hoy sin uso. */
  action?: ReactNode
}) {
  const total = subtotal + (deliveryFee ?? 0)

  return (
    <div className="rounded-3xl bg-white/80 p-5 shadow-client-card backdrop-blur-xl dark:bg-white/5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-base font-medium">
          <span className="h-2 w-2 rounded-full bg-brand-500" aria-hidden />
          Resumen del pedido
        </h2>
        {action}
      </div>

      {/* Filas dentro de LA MISMA tarjeta, separadas por divider — no
          tarjetas propias por producto (ver Fase 2.3). */}
      <ul className="mt-4 divide-y divide-black/5 dark:divide-white/10">
        {items.map((item, index) => (
          <li key={index} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
            <div className="h-11 w-11 shrink-0 overflow-hidden rounded-xl bg-muted">
              {item.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.imageUrl} alt={item.productName ?? ''} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-xs font-medium text-muted-foreground">
                  {item.productName?.charAt(0) ?? '?'}
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{item.productName}</p>
              <p className="text-xs text-muted-foreground">
                {item.quantity} x S/ {item.unitPrice.toFixed(2)}
              </p>
            </div>
            <span className="shrink-0 text-sm font-medium tabular-nums">
              S/ {(item.unitPrice * item.quantity).toFixed(2)}
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-4 space-y-1.5 border-t border-black/5 pt-4 dark:border-white/10">
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>Subtotal</span>
          <span className="tabular-nums">S/ {subtotal.toFixed(2)}</span>
        </div>
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>Envío</span>
          <span className="tabular-nums">
            {deliveryFee !== null ? `S/ ${deliveryFee.toFixed(2)}` : 'Por confirmar'}
          </span>
        </div>
        <div className="flex items-center justify-between pt-1.5">
          <span className="text-sm font-medium">Total</span>
          <span className="text-xl font-bold tabular-nums text-brand-700">
            S/ {total.toFixed(2)}
          </span>
        </div>
        {deliveryFee !== null && (
          <p className="pt-1 text-xs text-muted-foreground">
            El envío se paga directo a tu repartidor por Yape.
          </p>
        )}
      </div>
    </div>
  )
}
```

### 3.4 — Tarjeta "Entrega" (fusiona dirección + notas)

Reemplaza las dos tarjetas casi idénticas del diagnóstico por una sola tarjeta **secundaria** con dos filas internas (no dos tarjetas):

```tsx
{(order.addresses || order.notes) && (
  <div className="rounded-3xl border border-black/5 bg-white/50 p-5 dark:border-white/10 dark:bg-white/[0.03]">
    <h2 className="text-sm font-medium text-muted-foreground">Entrega</h2>
    <div className="mt-3 space-y-3">
      {order.addresses && (
        <div className="flex items-start gap-2.5">
          <MapPinIcon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            <p className="text-sm">{order.addresses.address_text}</p>
            {order.addresses.reference && (
              <p className="text-xs text-muted-foreground">{order.addresses.reference}</p>
            )}
          </div>
        </div>
      )}
      {order.notes && (
        <div className="flex items-start gap-2.5">
          <StickyNoteIcon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <p className="min-w-0 text-sm text-muted-foreground">{order.notes}</p>
        </div>
      )}
    </div>
  </div>
)}
```

### 3.5 — Layout de dos columnas + sticky en desktop

```tsx
<ClientPageContainer size="wide">
  {/* encabezado (3.2) */}

  <div className="mt-6 grid gap-4 md:grid-cols-[1fr_22rem] md:items-start md:gap-6">
    <div className="space-y-4 md:order-1">
      <OrderStatusSection orderId={order.id} initialStatus={order.status} />
      {deliveryOffer && (
        <DeliveryPaymentCard orderId={order.id} deliveryPerson={deliveryOffer} />
      )}
      <EntregaCard /* 3.4 */ />
    </div>

    {/* sticky solo desde md: en móvil el resumen es un bloque más del flujo,
        no flota (no hay una segunda columna donde anclarlo) */}
    <div className="md:sticky md:top-20 md:order-2">
      <OrderSummaryCard
        items={order.order_items.map((item) => ({
          productName: item.product_name,
          quantity: item.quantity,
          unitPrice: Number(item.unit_price),
          imageUrl: item.image_url,
        }))}
        subtotal={Number(order.total)}
        deliveryFee={deliveryFee}
      />
    </div>
  </div>
</ClientPageContainer>
```

`md:order-2` en el resumen y `md:order-1` en la columna de seguimiento son necesarios porque en móvil (sin `order-*`, fuente del DOM) el resumen debe aparecer **antes** que "Entrega" según 3.1 — en desktop el `grid-cols` ya los separa espacialmente y el orden del DOM deja de importar visualmente, pero se fija explícito para que no dependa de la casualidad del `grid-template-columns`.

`md:top-20` dejando aire respecto al header (`CustomerHeader` es `sticky top-0`, con padding propio) para que el resumen pegajoso no quede pegado al borde superior sin aire.

### 3.6 — `OrderStatusSection` y `OrderStatusTimeline`: sin cambios de lógica, ajuste de contenedor

`OrderStatusSection` ya envuelve el timeline en una tarjeta con `shadow-client-card` — se mantiene como **tarjeta primaria** (junto con `OrderSummaryCard`, son los dos focos de atención de la página: "¿cómo va?" y "¿qué pedí/cuánto pago?"). Sin cambios funcionales; solo se retira cualquier margen propio (`mt-6` hardcodeado) que hoy asume que es el primer bloque de la página, porque ahora vive dentro de un contenedor `space-y-4` que ya controla el espaciado entre hermanos (ver Fase 2.1).

### 3.7 — Checklist de aceptación de la Fase 3

- [ ] En desktop (`≥768px`), la página muestra dos columnas: seguimiento a la izquierda, resumen del pedido pegajoso a la derecha, que permanece visible al hacer scroll por una lista larga de productos.
- [ ] En móvil, el orden es: encabezado → estado → pago (si aplica) → resumen del pedido → entrega — el resumen ya no queda al final de la página.
- [ ] Ya no existe ninguna tarjeta por producto individual — los productos son filas dentro de `OrderSummaryCard`, separadas por un divisor sutil.
- [ ] Dirección y notas viven en una sola tarjeta "Entrega", no en dos tarjetas separadas.
- [ ] El identificador corto del pedido (`#XXXXXXXX`) aparece en el encabezado.
- [ ] Un pedido `DELIVERED` (sin `OrderStatusSection`, que retorna `null` en ese estado) sigue viéndose bien sin el hueco que dejaría el timeline — el `space-y-4` de la columna izquierda no deja un espacio vacío cuando el primer hijo no se renderiza.
- [ ] Un pedido sin notas y sin `AWAITING_PAYMENT` (el caso más simple: `PENDING` recién creado) muestra solo estado + resumen + (posiblemente) entrega, sin tarjetas vacías ni condicionales rotos.
- [ ] `pnpm run typecheck`, `pnpm run lint`, `pnpm run build` sin errores nuevos.

### 3.8 — Archivos tocados en la Fase 3

**Nuevo:** `components/features/orders/OrderSummaryCard.tsx`, `components/layout/ClientPageContainer.tsx` (si no se creó ya en la Fase 2).
**Modificados:** `app/cliente/pedidos/[id]/page.tsx` (reescritura del layout), `components/features/orders/OrderStatusSection.tsx` (ajuste de margen propio).

---

## Fase 4 — Auditoría y pulido de tarjetas transversal

**Objetivo:** que el resto del panel de cliente (home, lista de pedidos, direcciones, carrito, perfil) adopte la misma disciplina de espaciado (Fase 2) y el mismo criterio de tarjeta primaria/secundaria (Fase 2.3) que la página de detalle de pedido, para que el panel se sienta hecho por el mismo equipo el mismo día — sin rediseñar lo que ya funciona bien.

### 4.1 — `app/cliente/pedidos/page.tsx` + `OrdersListClient.tsx`

- Adoptar `ClientPageContainer size="wide"` en vez del `<div>` suelto actual.
- Unificar `space-y-3` (entre tarjetas de pedido) y `space-y-5` (entre grupos de día) contra la escala de la Fase 2.1: quedan igual porque ya coinciden con la convención (tarjetas hermanas = `space-y-4`; nota: aquí se mantiene `space-y-3` porque las tarjetas de pedido son más compactas que las de la página de detalle — se documenta como la única excepción consciente a la escala, por densidad de lista).
- Los banners de "buscando repartidor" / "confirma el pago" (`amber-50`, ya con buen contraste corregido en el ciclo anterior) no cambian — ya siguen el patrón correcto.

### 4.2 — `ClienteHomeClient.tsx`

- Envolver en `ClientPageContainer` no aplica aquí (la home ya vive dentro de `app/cliente/layout.tsx`, que controla su propio `max-w-5xl`) — se deja como está, mismo criterio que "no tocar lo que ya funciona".
- Unificar el espaciado entre secciones grandes (hero, logos, categorías, populares, restaurantes) a `space-y-8 sm:space-y-10` (hoy es un `space-y-10` general en el contenedor raíz que ya cumple la convención — se verifica, no se cambia).
- El único ajuste real: los `mb-3`/`mt-4`/`mt-8` sueltos que preceden a cada `<h2>` de sección se homologan a `mb-3` (nivel "dentro de una sección", Fase 2.1) para que el título de cada sección quede a la misma distancia de su contenido en las cinco secciones de la home.

### 4.3 — `AddressCard.tsx` / `app/cliente/direcciones/page.tsx`

- `AddressCard` ya es la referencia visual del panel (glass, `shadow-client-card`, ícono con degradado) — pasa a `p-5` (tarjeta primaria, es literalmente lo único que hay en esa página) en vez de su `p-5` actual... **ya está en `p-5`, sin cambios**. Se documenta como verificado, no como tarea.
- La página adopta `ClientPageContainer size="narrow"`.

### 4.4 — `CartClient.tsx`

- Las tarjetas de línea de producto del carrito (`p-3.5`) se mantienen — son conceptualmente distintas de "Entrega" en el detalle de pedido: en el carrito el cliente **edita** cantidades (necesita área táctil por fila), en el detalle de pedido solo **lee** un historial. No se fuerza la unificación donde la función del componente es distinta — mismo criterio de `ui-ux-pro-max` de no sobre-abstraer componentes que se parecen visualmente pero cumplen roles distintos.
- El bloque de total del carrito (`sticky bottom-4`, ya implementado en el ciclo anterior) se mantiene sin cambios — ya resuelve el mismo problema (\"el total no debe perderse de vista\") que la Fase 3 resuelve para el detalle de pedido con la columna sticky.

### 4.5 — `ProfileForm.tsx` (uso en `/cliente/perfil`)

- Página adopta `ClientPageContainer size="narrow"`. Sin cambios de contenido — el avatar de solo lectura (`showAccountAvatar`) ya resuelve la identidad visual pedida en el ciclo anterior.

### 4.6 — Checklist de aceptación de la Fase 4

- [ ] Las cinco páginas internas del panel de cliente (`pedidos`, `pedidos/[id]`, `direcciones`, `carrito`, `perfil`) usan `ClientPageContainer` con el `size` que corresponde a su contenido.
- [ ] Ningún componente que ya seguía la convención de la Fase 2 se reescribe innecesariamente (se documenta como "verificado" en vez de tocarlo).
- [ ] La home conserva su diseño actual (ya validado en el ciclo de `plan-mejora-ui-panel-cliente.md`) con solo el ajuste puntual de espaciado bajo títulos de sección.

---

## Fase 5 — Accesibilidad, responsive y `prefers-reduced-motion`

No introduce componentes nuevos — es la pasada de verificación obligatoria sobre todo lo tocado en las Fases 3 y 4, siguiendo el mismo rigor que ya se aplicó en el ciclo anterior del panel de cliente (medir contraste, no estimarlo).

1. **Contraste:** el texto `text-brand-700` sobre `bg-white/80` del total (`OrderSummaryCard`) y sobre `bg-white/50` (tarjeta "Entrega") se mide, no se asume — ambos ya son combinaciones usadas en el resto del panel (`AddressCard`, `app/cliente/pedidos/[id]/page.tsx` actual), así que el riesgo es bajo, pero se verifica explícitamente por ser una tarjeta nueva.
2. **Foco visible:** el `:focus-visible` global (`app/globals.css`) ya cubre cualquier control nuevo sin que haga falta código adicional — verificar que ningún elemento de `OrderSummaryCard`/tarjeta "Entrega" use `outline-none` sin reemplazo (ninguno de los dos es interactivo, así que no aplica, pero se confirma).
3. **Objetivo táctil:** ninguna fila de `OrderSummaryCard` es interactiva (es de solo lectura), así que no aplica el mínimo de 40×40px ahí — sí sigue aplicando, sin cambios, a los controles ya existentes de `OrderStatusSection`/`CancelOrderButton`.
4. **`prefers-reduced-motion`:** el layout sticky de la columna derecha (Fase 3.5) no introduce ninguna animación — `position: sticky` no es una transición animada, así que no hay nada que neutralizar. El resto de animaciones del panel (badge del carrito, reloj con tic, `animate-fade-up`) no se tocan en este plan.
5. **Breakpoints:** verificar 375px, 428px, 768px (el punto exacto donde el grid de dos columnas de la Fase 3 se activa) y 1024px+ en la página de detalle de pedido — es la única pantalla de este plan con un cambio real de layout entre móvil y desktop.

### Checklist de aceptación de la Fase 5

- [ ] Contraste de `text-brand-700` sobre los dos fondos nuevos medido y ≥ 4.5:1 (texto normal) o ≥ 3:1 (el monto grande, `text-xl font-bold`, cuenta como texto grande).
- [ ] En el breakpoint exacto de `md:` (768px), el grid pasa de una a dos columnas sin que ningún elemento quede cortado o superpuesto.
- [ ] El resumen sticky no se superpone con el header al hacer scroll (`md:top-20` verificado visualmente, no solo en el código).

---

## Fase 6 — QA final, checklist de regresión y orden de despliegue

### 6.1 — Orden de despliegue recomendado

1. **Fase 1 sola, en su propio release.** Es independiente, no toca base de datos, y de riesgo mínimo — mergeable de inmediato tras el checklist 1.7.
2. **Fase 2 (fundamentos)** en el mismo release que 3 y 4, o antes — es mayormente invisible (un componente de layout nuevo sin consumidores todavía no cambia nada visible).
3. **Fases 3 y 4** en el mismo release final: 3 depende de 2; 4 es la pasada de consistencia que solo tiene sentido una vez existe el nuevo patrón de la Fase 3.
4. **Fase 5** corre como criterio de aceptación de cada PR de las Fases 3-4, no como un paso separado al final.

### 6.2 — Checklist de regresión completo

- [ ] Ofertar un envío desde "Disponibles" sigue funcionando de punta a punta (oferta → `AWAITING_PAYMENT` → confirmación de pago → `ASSIGNED`), ahora con tarifa 100% libre desde el primer toque.
- [ ] Ningún repartidor ve un cálculo o sugerencia de precio basado en la distancia, en ninguna pantalla.
- [ ] La dirección de entrega sigue siendo visible al repartidor antes de ofertar (esto no debía cambiar y hay que confirmar que no se rompió al tocar `AvailableOrdersClient`).
- [ ] `/cliente/pedidos/[id]` se ve correctamente en los 4 estados representativos: `PENDING` (sin oferta), `AWAITING_PAYMENT` (con tarjeta de pago), `ASSIGNED`/`ON_THE_WAY` (con envío ya confirmado, timeline avanzando), `DELIVERED` (sin timeline) y `CANCELLED` (mensaje de cancelado).
- [ ] El resumen del pedido permanece fijo (sticky) al hacer scroll en desktop con un pedido de 6+ productos.
- [ ] Las páginas de direcciones, carrito y perfil no muestran ninguna regresión visual respecto al estado anterior a este plan.
- [ ] `pnpm run typecheck`, `pnpm run lint` y `pnpm run build` en verde.
- [ ] Verificación manual en mobile real o emulado (375px, 428px) de la página de detalle de pedido, que es la única con cambio estructural de layout.

### 6.3 — Rollback

Ambas fases son reversibles con un simple revert de commit: la Fase 1 no toca datos (los campos `delivery_fee` en base ya existían y se mantienen intactos, solo cambia qué número se precarga en un input), y la Fase 3-4 son cambios puramente de presentación sobre datos que ya se leían igual antes. No hay migraciones que revertir en ningún punto de este plan.

---

## Resumen de archivos

### Nuevos
- `components/layout/ClientPageContainer.tsx` — Fase 2.
- `components/features/orders/OrderSummaryCard.tsx` — Fase 3.

### Eliminados
- `lib/geo/distance.ts` — Fase 1 (sin consumidores tras la limpieza de `SendOfferForm`/`AvailableOrdersClient`).

### Modificados
- `lib/validations/delivery-offer.ts` — Fase 1 (quita `suggestedDeliveryFee`).
- `components/features/deliveries/SendOfferForm.tsx` — Fase 1 (tarifa fija editable, sin distancia).
- `components/features/deliveries/AvailableOrdersClient.tsx` — Fase 1 (quita cálculo de distancia).
- `app/api/v1/orders/route.ts` — Fase 1 (quita `latitude/longitude` del select de restaurantes para `DELIVERY`).
- `types/order.ts` — Fase 1 (`ApiOrderItem.restaurants` sin coordenadas).
- `app/cliente/pedidos/[id]/page.tsx` — Fase 3 (layout de dos columnas + jerarquía nueva).
- `components/features/orders/OrderStatusSection.tsx` — Fase 3 (ajuste de margen propio).
- `app/cliente/pedidos/page.tsx`, `components/features/orders/OrdersListClient.tsx` — Fase 4.
- `components/features/cliente-home/ClienteHomeClient.tsx` — Fase 4 (espaciado bajo títulos).
- `app/cliente/direcciones/page.tsx`, `app/cliente/perfil/page.tsx` — Fase 4 (adoptan `ClientPageContainer`).

Ningún otro archivo del repo necesita tocarse para cumplir lo pedido — en particular, `/admin`, `/restaurante`, la landing pública y toda la capa de RLS/funciones SQL del flujo de envío quedan fuera de alcance y sin cambios.
