import {
  ORDER_STATUS_STEPS,
  ORDER_STATUS_LABELS,
  type OrderStatus,
} from '@/lib/constants/order-status'
import { cn } from '@/lib/utils'

export function OrderStatusTimeline({ status }: { status: OrderStatus }) {
  if (status === 'CANCELLED') {
    return (
      <p className="text-sm font-medium text-destructive">
        Este pedido fue cancelado.
      </p>
    )
  }

  const currentIndex = ORDER_STATUS_STEPS.indexOf(
    status as (typeof ORDER_STATUS_STEPS)[number]
  )

  return (
    <ol className="space-y-3">
      {ORDER_STATUS_STEPS.map((step, index) => {
        const done = index <= currentIndex
        // El paso "en curso" y los ya completados se distinguen: `done` dice
        // "ya pasó", `isCurrent` dice "está pasando ahora".
        const isCurrent = index === currentIndex
        return (
          <li key={step} className="relative flex items-center gap-3">
            {/* Rail de progreso: conecta cada círculo con el siguiente. El
                tramo ya recorrido va en color de marca y el pendiente en
                gris, así el avance se lee de un vistazo y no sólo por el
                color del círculo. Arranca en el borde inferior del círculo
                (top-6) y termina en el borde del siguiente, cubriendo el
                hueco del `space-y-3`. */}
            {index < ORDER_STATUS_STEPS.length - 1 && (
              <span
                aria-hidden
                className={cn(
                  'absolute left-[11px] top-6 h-[calc(100%-0.75rem)] w-0.5',
                  index < currentIndex ? 'bg-brand-500' : 'bg-muted'
                )}
              />
            )}
            <span
              className={cn(
                'relative flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-medium',
                done
                  ? 'bg-foreground text-background'
                  : 'bg-muted text-muted-foreground',
                isCurrent && 'ring-2 ring-brand-500/40'
              )}
            >
              {/* Halo que se expande detrás del número (el número se pinta
                  después, así que nunca pierde legibilidad, a diferencia de
                  animar la opacidad del círculo completo). */}
              {isCurrent && (
                <span
                  aria-hidden
                  className="absolute inset-0 animate-ping rounded-full bg-brand-500/40"
                />
              )}
              {index + 1}
            </span>
            <span
              className={
                done
                  ? 'text-sm font-medium'
                  : 'text-sm text-muted-foreground'
              }
            >
              {ORDER_STATUS_LABELS[step]}
            </span>
          </li>
        )
      })}
    </ol>
  )
}