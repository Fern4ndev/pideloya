/**
 * Tarjeta de pedido usada tanto en "Disponibles" (con el formulario de
 * oferta en el pie) como en el detalle de la entrega (con badge de estado +
 * botón para avanzar). Antes cada página tenía su propia copia casi idéntica
 * de este bloque — ahora solo cambian los props que le pasa cada página.
 */

import { Clock3Icon } from 'lucide-react'
import { formatRemainingDeliveryWindow } from '@/lib/delivery-window'
import { cn } from '@/lib/utils'

export function DeliveryOrderCard({
  restaurantName,
  pickupAddress,
  itemsSummary,
  deliveryAddress,
  deliveryReference,
  total,
  remainingMs,
  badge,
  action,
  footer,
}: {
  restaurantName: string
  pickupAddress?: string | null
  itemsSummary?: string
  deliveryAddress?: string | null
  deliveryReference?: string | null
  total: number
  /**
   * Milisegundos restantes de la ventana de 5 minutos para conseguir
   * repartidor. Solo la lista de Disponibles lo pasa (los PENDING): el pill
   * ámbar con `mm:ss` es el mismo que ve el cliente en su lista, calculado
   * con el mismo `created_at`. En 0 muestra "Vencido" en rojo — el pedido está
   * por cancelarse solo.
   */
  remainingMs?: number | null
  /** Si se pasa (ej. OrderStatusBadge), el precio y la acción bajan a
   * una fila inferior separada por un borde — así se ve el detalle. */
  badge?: React.ReactNode
  action?: React.ReactNode
  /** Bloque a lo ancho de la tarjeta, en su propia fila al pie. Para acciones
   * que necesitan más espacio que un botón (ej. el formulario de oferta de
   * envío, con su input de tarifa). */
  footer?: React.ReactNode
}) {
  return (
    <div className="rounded-xl border p-4 transition-colors hover:border-muted-foreground/30">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className="text-sm font-medium">{restaurantName}</p>
            {remainingMs !== null && remainingMs !== undefined && (
              <span
                title={
                  remainingMs > 0
                    ? 'Tiempo restante para aceptar este pedido'
                    : 'Este pedido venció y está por cancelarse'
                }
                className={cn(
                  'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium tabular-nums',
                  remainingMs > 0
                    ? 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-200'
                    : 'bg-destructive/10 text-destructive'
                )}
              >
                <Clock3Icon className="h-3 w-3" aria-hidden />
                {remainingMs > 0 ? formatRemainingDeliveryWindow(remainingMs) : 'Vencido'}
              </span>
            )}
          </div>
          {pickupAddress && (
            <p className="text-xs text-muted-foreground">
              Recoger en: {pickupAddress}
            </p>
          )}
          {itemsSummary && (
            <p className="mt-2 text-sm text-muted-foreground">
              {itemsSummary}
            </p>
          )}
          {deliveryAddress && (
            <p className="mt-1 text-xs text-muted-foreground">
              Entregar en: {deliveryAddress}
            </p>
          )}
          {deliveryReference && (
            <p className="text-xs text-muted-foreground">
              {deliveryReference}
            </p>
          )}
        </div>

        {badge ? (
          badge
        ) : (
          <div className="shrink-0 text-right">
            <p className="text-sm font-semibold">S/ {total.toFixed(2)}</p>
            {action}
          </div>
        )}
      </div>

      {badge && (
        <div className="mt-3 flex items-center justify-between border-t pt-3">
          <span className="text-sm font-semibold">S/ {total.toFixed(2)}</span>
          {action}
        </div>
      )}

      {footer && <div className="mt-3 border-t pt-3">{footer}</div>}
    </div>
  )
}