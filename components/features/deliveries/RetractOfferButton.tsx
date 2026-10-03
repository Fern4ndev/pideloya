'use client'

import { useState } from 'react'
import { retractDeliveryOffer } from '@/lib/actions/deliveries'
import { ConfirmDialog } from '@/components/features/admin/ConfirmDialog'
import { Button } from '@/components/ui/button'

/**
 * Retira la oferta de envío mientras el cliente no confirmó el pago.
 *
 * Con confirmación explícita: retirarse deja al cliente sin repartidor y
 * devuelve el pedido al pool, así que el repartidor no debería poder hacerlo
 * con un toque accidental. El monto que estaba cobrando se muestra en el
 * diálogo — es justo el dato que necesita para decidir si se retira.
 */
export function RetractOfferButton({
  orderId,
  deliveryFee,
}: {
  orderId: string
  deliveryFee: number | null
}) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        className="text-muted-foreground hover:text-foreground"
        onClick={() => setOpen(true)}
      >
        Retirar oferta
      </Button>

      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="¿Retirar tu oferta de envío?"
        description={
          deliveryFee === null
            ? 'El pedido volverá a estar disponible para otros repartidores.'
            : `Estás cobrando S/ ${deliveryFee.toFixed(2)} por este envío. El pedido volverá a estar disponible para otros repartidores.`
        }
        confirmLabel="Retirar oferta"
        onConfirm={async () => retractDeliveryOffer(orderId)}
      />
    </>
  )
}
