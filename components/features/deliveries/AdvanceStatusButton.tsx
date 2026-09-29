'use client'

import { useState, useTransition } from 'react'
import { advanceOrderStatus } from '@/lib/actions/deliveries'
import { ConfirmDialog } from '@/components/features/admin/ConfirmDialog'
import { Button } from '@/components/ui/button'
import type { OrderStatus } from '@/types/order'
import type { PaymentMethod } from '@/lib/constants/payment-method'
import { useToast } from '@/components/ui/toast'

const NEXT_LABEL: Record<string, string> = {
  ASSIGNED: 'Marcar como recogido',
  PICKED_UP: 'Marcar en camino',
  ON_THE_WAY: 'Marcar entregado',
}

/**
 * Avanza el pedido al siguiente estado del flujo de entrega.
 *
 * El último paso de un pedido en EFECTIVO no se puede cerrar con un toque: es
 * el momento exacto en que el repartidor recibe la plata del cliente, y ese
 * toque es el único registro de que la cobró (`cash_collected_at`). Por eso el
 * botón, en ese caso, no ejecuta nada por sí solo — abre una confirmación con
 * el monto a la vista (D6), y recién al confirmar llama a
 * `advanceOrderStatus(..., { cashCollected: true })`.
 *
 * El diálogo es la UX, no la garantía: la guarda real vive en
 * `complete_delivery()`, que rechaza la entrega de un CASH sin el flag. Si el
 * repartidor llegara igual (otra pestaña, la API), la base responde 400 y el
 * toast lo muestra; nunca queda un "entregado" sin constancia de cobro.
 *
 * Para Yape y para los pedidos legacy (sin método) el botón funciona como
 * antes, sin paso extra: ahí el dinero ya se movió por Yape antes de que el
 * pedido saliera de la tienda.
 */
export function AdvanceStatusButton({
  orderId,
  currentStatus,
  paymentMethod = null,
  cashAmount = null,
}: {
  orderId: string
  currentStatus: OrderStatus
  /** Método elegido por el cliente; solo CASH agrega la confirmación. */
  paymentMethod?: PaymentMethod | null
  /** Monto que el repartidor cobra en efectivo (comida + envío, D1). */
  cashAmount?: number | null
}) {
  const [isPending, startTransition] = useTransition()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const label = NEXT_LABEL[currentStatus]
  const { success, error } = useToast()

  if (!label) return null

  const cashOnDelivery = currentStatus === 'ON_THE_WAY' && paymentMethod === 'CASH'
  // `cashAmount` llega como número siempre (los call sites lo derivan con
  // `cashAmountDue()`), pero el texto no depende de eso: si faltara, el diálogo
  // pregunta por "el monto" en vez de mostrar "S/ NaN".
  const amountText = cashAmount !== null ? `S/ ${cashAmount.toFixed(2)}` : 'el monto'

  function handleClick() {
    if (cashOnDelivery) {
      setConfirmOpen(true)
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

      {cashOnDelivery && (
        // `variant="default"` y no "destructive": entregar y cobrar es el
        // cierre normal del pedido, no una acción de la que haya que disuadir
        // (a diferencia de "Retirar oferta", que sí usa el rojo).
        <ConfirmDialog
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          variant="default"
          title={`¿Cobraste ${amountText} en efectivo?`}
          description="Al confirmar, el pedido queda como ENTREGADO y se registra que cobraste. Si todavía no te pagó, cancela y cóbralo primero."
          confirmLabel="Sí, cobré y entregué"
          onConfirm={async () => {
            await advanceOrderStatus(orderId, currentStatus, { cashCollected: true })
            return {
              success: true,
              message: 'Entrega registrada. Quedó constancia del cobro en efectivo.',
            }
          }}
        />
      )}
    </>
  )
}
