/**
 * Tarjeta de pedido usada tanto en "Disponibles" (con botón Aceptar)
 * como en "Mis entregas" (con badge de estado + botón para avanzar).
 * Antes cada página tenía su propia copia casi idéntica de este bloque
 * — ahora solo cambian los props que le pasa cada página.
 */
export function DeliveryOrderCard({
  restaurantName,
  pickupAddress,
  itemsSummary,
  deliveryAddress,
  deliveryReference,
  total,
  badge,
  action,
}: {
  restaurantName: string
  pickupAddress?: string | null
  itemsSummary?: string
  deliveryAddress?: string | null
  deliveryReference?: string | null
  total: number
  /** Si se pasa (ej. OrderStatusBadge), el precio y la acción bajan a
   * una fila inferior separada por un borde — así se ve "Mis entregas". */
  badge?: React.ReactNode
  action?: React.ReactNode
}) {
  return (
    <div className="rounded-xl border p-4 transition-colors hover:border-muted-foreground/30">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium">{restaurantName}</p>
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
    </div>
  )
}