'use client'

import { useState, useTransition } from 'react'
import { advanceOrderStatus } from '@/lib/actions/deliveries'
import { CollectPaymentDialog } from '@/components/features/deliveries/CollectPaymentDialog'
import { PickupDialog } from '@/components/features/deliveries/PickupDialog'
import { Button } from '@/components/ui/button'
import type { OrderStatus } from '@/types/order'
import type { PaymentMethod, PaymentTiming } from '@/lib/constants/payment-method'
import { useToast } from '@/components/ui/toast'

const NEXT_LABEL: Record<string, string> = {
  ASSIGNED: 'Marcar como recogido',
  PICKED_UP: 'Marcar en camino',
  ON_THE_WAY: 'Marcar entregado',
}

/**
 * Avanza el pedido al siguiente estado del flujo de entrega.
 *
 * El último paso de un pedido que se paga AL RECIBIR no se puede cerrar con un
 * toque: es el momento exacto en que el repartidor recibe la plata, y el medio
 * REAL del cobro (`collected_method`) debe quedar registrado junto con la
 * entrega. Por eso el botón abre el diálogo "¿Cómo te pagó?"
 * (CollectPaymentDialog), que exige una atestación explícita antes de llamar a
 * `advanceOrderStatus(..., { collected: true, collectedMethod })`.
 *
 * El diálogo es la UX, no la garantía: la guarda real vive en
 * `complete_delivery()` v2, que rechaza la entrega de un pedido ON_DELIVERY sin
 * el cobro declarado. Si el repartidor llegara igual (otra pestaña, la API), la
 * base responde 22000 y el toast lo muestra — nunca queda un "entregado" sin
 * constancia de cobro.
 *
 * Para Yape POR ADELANTADO y para los pedidos legacy (sin timing) el botón
 * funciona como antes, sin paso extra: ese dinero ya se movió antes de que el
 * pedido saliera de la tienda.
 */
export function AdvanceStatusButton({
  orderId,
  currentStatus,
  paymentMethod = null,
  paymentTiming = null,
  cashAmount = null,
  foodAmount = null,
  restaurantName = 'el restaurante',
}: {
  orderId: string
  currentStatus: OrderStatus
  /** Método anunciado por el cliente; solo alimenta la preselección del diálogo. */
  paymentMethod?: PaymentMethod | null
  /** Cuándo paga el cliente (D2); define si hay cobro que declarar al entregar. */
  paymentTiming?: PaymentTiming | null
  /** Monto que el repartidor cobra al recibir (comida + envío, D1). */
  cashAmount?: number | null
  /** Comida (orders.total): el adelanto que muestra PickupDialog (Fase 5). */
  foodAmount?: number | null
  /** Restaurante donde recoge, para el título del diálogo. */
  restaurantName?: string
}) {
  const [isPending, startTransition] = useTransition()
  const [collectOpen, setCollectOpen] = useState(false)
  const [pickupOpen, setPickupOpen] = useState(false)
  const label = NEXT_LABEL[currentStatus]
  const { success, error } = useToast()

  if (!label) return null

  // "Cobro al declarar" aplica a TODO pago al recibir (Yape o efectivo). El
  // método anunciado (paymentMethod) puede faltar en filas legacy: en ese caso
  // el único método que existía era efectivo.
  const needsCollection =
    currentStatus === 'ON_THE_WAY' &&
    (paymentTiming === 'ON_DELIVERY' || (paymentTiming === null && paymentMethod === 'CASH'))
  const announcedMethod: PaymentMethod = paymentMethod ?? 'CASH'
  // `cashAmount` llega como número siempre (los call sites lo derivan con
  // `amountDueToCourier()`), pero el texto no depende de eso: si faltara, el
  // diálogo muestra "S/ 0.00" y no "S/ NaN".
  const amountText = (cashAmount ?? 0).toFixed(2)

  function handleClick() {
    if (needsCollection) {
      setCollectOpen(true)
      return
    }

    // Primer paso (Fase 5): el diálogo "¿Pagaste el pedido?" captura la
    // constancia D6 ANTES de avanzar. Sin ella, `restaurant_paid_at` nunca
    // se escribiría y el restaurante no podría probar que le pagaron.
    if (currentStatus === 'ASSIGNED') {
      setPickupOpen(true)
      return
    }

    startTransition(async () => {
      try {
        await advanceOrderStatus(orderId, currentStatus)
        success('Estado actualizado')
      } catch (err) {
        error('Algo salió mal', err instanceof Error ? err.message : undefined)
      }
    })
  }

  return (
    <>
      <Button size="sm" variant="lime" disabled={isPending} onClick={handleClick}>
        {isPending ? 'Actualizando…' : label}
      </Button>

      {needsCollection && (
        <CollectPaymentDialog
          open={collectOpen}
          onOpenChange={setCollectOpen}
          orderId={orderId}
          announcedMethod={announcedMethod}
          amount={amountText}
        />
      )}

      {currentStatus === 'ASSIGNED' && (
        <PickupDialog
          open={pickupOpen}
          onOpenChange={setPickupOpen}
          orderId={orderId}
          restaurantName={restaurantName}
          foodAmount={foodAmount ?? 0}
          totalAmount={cashAmount ?? 0}
          timing={paymentTiming}
        />
      )}
    </>
  )
}
