import type { ReactNode } from 'react'

export type SummaryItem = {
  productName: string | null
  quantity: number
  unitPrice: number
  imageUrl: string | null
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
 */
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
