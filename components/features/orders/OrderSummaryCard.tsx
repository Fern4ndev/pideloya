import type { ReactNode } from 'react'
import {
  amountDueToCourier,
  paymentLabel,
  type PaymentMethod,
  type PaymentTiming,
} from '@/lib/constants/payment-method'

export type SummaryItem = {
  productName: string | null
  quantity: number
  unitPrice: number
  imageUrl: string | null
}

/**
 * Filas de productos. Vive FUERA de `OrderSummaryCard` a propósito
 * (vercel-react-best-practices: nunca declarar un componente dentro de otro):
 * una función-componente definida adentro se re-crea en cada render, React la
 * ve como un tipo distinto y DESMONTA/REMONTA el subárbol. Acá eso costaría el
 * estado abierto/cerrado del `<details>` de más abajo: el cliente lo abriría y
 * se cerraría solo en el siguiente render.
 */
function ItemList({ items }: { items: SummaryItem[] }) {
  return (
    <ul className="mt-4 divide-y divide-black/5 dark:divide-white/10">
      {items.map((item, index) => (
        <li key={index} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
          <div className="h-11 w-11 shrink-0 overflow-hidden rounded-xl bg-muted">
            {item.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={item.imageUrl}
                alt={item.productName ?? ''}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-xs font-medium text-muted-foreground">
                {item.productName?.charAt(0) ?? '?'}
              </div>
            )}
          </div>
          {/* `min-w-0` + `truncate`: un nombre de 80 caracteres sin espacios no
              puede ensanchar la tarjeta (los hijos de flex tienen
              `min-width: auto`, que es justo lo que permite ese desborde). */}
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
  )
}

/**
 * Resumen del pedido: productos + desglose de costos en UNA sola tarjeta
 * primaria. Reemplaza a las dos tarjetas sueltas que la página de detalle
 * renderizaba a mano (lista de tarjetas por producto + tarjeta de total),
 * que competían visualmente entre sí siendo conceptualmente la misma cosa:
 * "qué pedí y cuánto pago".
 *
 * Los productos son filas dentro de la tarjeta, separadas por un divisor —
 * no tarjetas propias (convención de la Fase 2.3 del plan). Es un componente
 * de servidor: no tiene estado ni interacción, así que no necesita JS de
 * cliente.
 *
 * Desde la Fase 5 del plan del método de pago, la fila "Envío" lleva un chip
 * con el método elegido y bajo el total aparece una nota que depende de ese
 * método. La razón es que el texto "El envío se paga directo a tu repartidor
 * por Yape." dejó de ser universal: mostrárselo a quien eligió pagar en
 * efectivo sería una afirmación falsa sobre su dinero.
 */
export function OrderSummaryCard({
  items,
  subtotal,
  deliveryFee,
  paymentMethod = null,
  paymentTiming = null,
  action,
  voucher,
}: {
  items: SummaryItem[]
  subtotal: number
  /** null = "por confirmar" (todavía no hay oferta o no se confirmó el pago). */
  deliveryFee: number | null
  /**
   * Método elegido por el cliente (snapshot de `orders.payment_method`) o null
   * si todavía no eligió / si es una entrega legacy aceptada sin oferta.
   */
  paymentMethod?: PaymentMethod | null
  /**
   * Cuándo paga (snapshot de `orders.payment_timing`): con los dos ejes la
   * nota bajo el total puede distinguir "Yape (pagado)" de "Yape al recibir".
   */
  paymentTiming?: PaymentTiming | null
  /** Slot para una acción contextual futura (ej. "Repetir pedido") — hoy sin uso. */
  action?: ReactNode
  /**
   * Slot para el comprobante de pago del envío (Fase 5 del plan de realtime).
   *
   * Va en ESTA tarjeta y no en una nueva porque el comprobante es la prueba del
   * `Envío S/ X` que se muestra dos centímetros más arriba: separarlos en dos
   * tarjetas volvería a fragmentar una misma idea ("cuánto pagué y con qué"),
   * que es justo lo que este componente existe para evitar.
   *
   * Es un slot y no un booleano: el contenido es un componente de cliente (el
   * diálogo) y esta tarjeta es de servidor — así el servidor decide SI hay
   * comprobante y el cliente solo se encarga de abrirlo.
   */
  voucher?: ReactNode
}) {
  // Total del pedido = comida + envío. `subtotal` es la comida: el nombre viene
  // de la tarjeta, que suma el envío por separado para poder mostrarlo.
  const total = subtotal + (deliveryFee ?? 0)
  const label = paymentLabel(paymentMethod, paymentTiming)
  const due = amountDueToCourier(subtotal, deliveryFee)

  // Nota bajo el total, según la TUPLA (método + momento) y no solo el método:
  //   - YAPE+UPFRONT     → pagado por adelantado: comida + envío (D1);
  //   - YAPE+ON_DELIVERY → yapeará al recibir: comida + envío;
  //   - CASH             → entregará el total en efectivo al recibir.
  //   - null             → ni chip ni nota (legacy o previo a la elección): no
  //     se inventa un método ni se promete algo que no eligió.
  // Auditar con `grep` (Fase 4.6): NINGÚN texto de un pedido ON_DELIVERY puede
  // decir "pagaste" ni "el envío se paga por Yape".
  const paymentNote =
    deliveryFee === null
      ? null
      : paymentMethod === null
        ? 'Elige cómo pagar el envío.'
        : paymentMethod === 'CASH'
          ? `Pagas S/ ${due.toFixed(2)} en efectivo al repartidor cuando llegue tu pedido: comida + envío.`
          : paymentTiming === 'ON_DELIVERY'
            ? `Pagas S/ ${due.toFixed(2)} por Yape a tu repartidor al recibir tu pedido: comida + envío.`
            : `Pagaste S/ ${due.toFixed(2)} por Yape a tu repartidor: comida + envío.`

  return (
    <div className="w-full min-w-0 rounded-3xl bg-white/80 p-5 shadow-client-card backdrop-blur-xl dark:bg-white/5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-base font-medium">
          <span className="h-2 w-2 rounded-full bg-brand-500" aria-hidden />
          Resumen del pedido
        </h2>
        {action}
      </div>

      {/* Con más de 3 productos la lista se colapsa en un `<details>` CERRADO:
          el resumen va ahora arriba de todo (Fase 3 del plan) y una lista larga
          empujaría el panel de pago —la acción pendiente— fuera de la primera
          pantalla en un móvil. El desglose de costos queda SIEMPRE visible, que
          es lo que el cliente viene a mirar. Es nativo (semántico, con teclado y
          con lector de pantalla) y no necesita una línea de JavaScript. */}
      {items.length > 3 ? (
        <details className="group mt-4">
          <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium">
            {items.length} productos
            <span className="text-xs font-normal text-muted-foreground group-open:hidden">
              Ver detalle
            </span>
            <span className="hidden text-xs font-normal text-muted-foreground group-open:inline">
              Ocultar
            </span>
          </summary>
          <ItemList items={items} />
        </details>
      ) : (
        <ItemList items={items} />
      )}

      <div className="mt-4 space-y-1.5 border-t border-black/5 pt-4 dark:border-white/10">
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>Subtotal</span>
          <span className="tabular-nums">S/ {subtotal.toFixed(2)}</span>
        </div>
        <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
          <span className="flex min-w-0 items-center gap-2">
            Envío
            {/* El método es TEXTO ("Yape al recibir"), no un punto de color:
                tiene que seguir siendo legible con daltonismo o impreso. */}
            {label && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900 dark:bg-amber-500/15 dark:text-amber-100">
                {label}
              </span>
            )}
          </span>
          <span className="shrink-0 tabular-nums">
            {deliveryFee !== null ? `S/ ${deliveryFee.toFixed(2)}` : 'Por confirmar'}
          </span>
        </div>
        <div className="flex items-center justify-between pt-1.5">
          <span className="text-sm font-medium">Total</span>
          <span className="text-xl font-bold tabular-nums text-brand-700">
            S/ {total.toFixed(2)}
          </span>
        </div>
        {/* `amber-900`: sobre el blanco de la tarjeta da ≈9:1, y sigue leyéndose
            en oscuro con `amber-100`. `muted-foreground` quedaba en el límite. */}
        {paymentNote && (
          <p className="pt-1 text-xs text-amber-900 dark:text-amber-100">{paymentNote}</p>
        )}
      </div>

      {voucher && (
        <div className="mt-4 border-t border-black/5 pt-4 dark:border-white/10">{voucher}</div>
      )}
    </div>
  )
}
