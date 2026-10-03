'use client'

import { useState, useTransition } from 'react'
import { advanceOrderStatus } from '@/lib/actions/deliveries'
import { PickupDialog } from '@/components/features/deliveries/PickupDialog'
import { PaymentIncidentDialog } from '@/components/features/orders/PaymentIncidentDialog'
import { COURIER_INCIDENT_KINDS } from '@/lib/constants/payment-incident'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import type { PaymentTiming } from '@/lib/constants/payment-method'
import type { OrderStatus } from '@/types/order'

const NEXT_LABEL: Record<string, string> = {
  ASSIGNED: 'Marcar como recogido',
  PICKED_UP: 'Marcar en camino',
  ON_THE_WAY: 'Finalizar entrega',
}

/**
 * Avanza el pedido al siguiente estado del flujo de entrega.
 *
 * El último paso de un pedido que se paga AL RECIBIR es UN TOQUE: antes el
 * botón abría el diálogo "¿Cómo te pagó?" (selector de medio + casilla de
 * atestación) para que `complete_delivery()` registrara el cobro declarado.
 * Ese medio dejó de preguntarse y la constancia pasó a ser `collected_at` =
 * "el repartidor finalizó la entrega con cobro", que la función escribe sola en
 * la MISMA transacción que marca DELIVERED — así que el paso extra solo
 * agregaba fricción en la puerta del cliente (migración 20261003100000).
 *
 * La salida honesta se conserva y es la única: **"No pude cobrar"**, un enlace
 * de texto secundario que abre el diálogo de incidencia. NO cierra la entrega
 * ni cambia el estado (D8): el pedido sigue `ON_THE_WAY`, el repartidor puede
 * reintentar el cobro y el reporte queda como evidencia para soporte. Sin esa
 * salida, el incentivo sería finalizar "como si" hubiera cobrado.
 *
 * Para pago por adelantado (y para los pedidos legacy) no hay incidencia ni
 * cobro que registrar: ese dinero ya se movió antes de que el pedido saliera de
 * la tienda.
 */
export function AdvanceStatusButton({
  orderId,
  currentStatus,
  paysOnDelivery = false,
  paymentTiming = null,
  foodAmount = null,
  restaurantName = 'el restaurante',
}: {
  orderId: string
  currentStatus: OrderStatus
  /** Snapshot: el pedido se paga al recibir => hay cobro que reportar. */
  paysOnDelivery?: boolean
  /** Cuándo paga el cliente: solo ON_DELIVERY implica adelanto propio. */
  paymentTiming?: PaymentTiming | null
  /** Comida (orders.total): el adelanto que muestra PickupDialog. */
  foodAmount?: number | null
  /** Restaurante donde recoge, para el título del diálogo de recogida. */
  restaurantName?: string
}) {
  const [isPending, startTransition] = useTransition()
  const [pickupOpen, setPickupOpen] = useState(false)
  const [incidentOpen, setIncidentOpen] = useState(false)
  const label = NEXT_LABEL[currentStatus]
  const { success, error } = useToast()

  if (!label) return null

  // La incidencia solo tiene sentido en el paso final de un pedido que se cobra
  // en la puerta: es el único momento en que el repartidor puede quedarse sin
  // cobrar algo que ya llevó.
  const canReportIncident = currentStatus === 'ON_THE_WAY' && paysOnDelivery

  function handleClick() {
    // Primer paso: el diálogo "¿Pagaste el pedido?" captura la constancia D6
    // ANTES de avanzar. Sin ella, `restaurant_paid_at` nunca se escribiría y el
    // restaurante no podría probar que le pagaron.
    if (currentStatus === 'ASSIGNED') {
      setPickupOpen(true)
      return
    }

    startTransition(async () => {
      try {
        await advanceOrderStatus(orderId, currentStatus)
        success('Entrega finalizada')
      } catch (err) {
        error('Algo salió mal', err instanceof Error ? err.message : undefined)
      }
    })
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button size="sm" variant="lime" disabled={isPending} onClick={handleClick}>
        {isPending ? 'Actualizando…' : label}
      </Button>

      {canReportIncident && (
        <>
          {/* Texto y no botón lleno: es una salida secundaria, no un camino que
              se empuje. `min-h-10` le da área táctil suficiente en la puerta
              aunque visualmente sea un enlace (40 px de alto).

              Color `foreground` y no `muted-foreground`: medido, el gris
              apagado da 3.29:1 sobre el blanco de la tarjeta y este texto es de
              12 px (necesita 4.5:1). El peso visual de "secundario" ya lo dan
              el tamaño, el subrayado y compartir fila con el CTA lleno. */}
          <button
            type="button"
            onClick={() => setIncidentOpen(true)}
            className="inline-flex min-h-10 items-center text-xs font-medium text-foreground underline underline-offset-4 hover:text-brand-600"
          >
            No pude cobrar
          </button>

          {/* Hermano del botón y NUNCA hijo del flujo de finalizar: el pedido NO
              pasa a DELIVERED al reportar (D8), el repartidor sigue en
              ON_THE_WAY. */}
          <PaymentIncidentDialog
            open={incidentOpen}
            onOpenChange={setIncidentOpen}
            orderId={orderId}
            kinds={COURIER_INCIDENT_KINDS}
            title="No pude cobrar"
            description="Cuéntanos qué pasó. El pedido sigue en camino: puedes reintentar el cobro o esperar a soporte."
            submitLabel="Registrar reporte"
            successTitle="Registramos tu reporte."
            successDescription="Soporte lo revisará. El pedido sigue en camino."
          />
        </>
      )}

      {currentStatus === 'ASSIGNED' && (
        <PickupDialog
          open={pickupOpen}
          onOpenChange={setPickupOpen}
          orderId={orderId}
          restaurantName={restaurantName}
          foodAmount={foodAmount ?? 0}
          timing={paymentTiming}
        />
      )}
    </div>
  )
}
