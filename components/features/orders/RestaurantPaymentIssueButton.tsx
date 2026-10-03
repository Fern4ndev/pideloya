'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { PaymentIncidentDialog } from '@/components/features/orders/PaymentIncidentDialog'

/**
 * "Reportar problema con el pago" (Fase 8.4): la vía formal del restaurante para
 * el caso "me dijeron que el repartidor pagó y no lo hizo".
 *
 * Solo puede reportar `RESTAURANT_NOT_PAID` y el RPC lo verifica del lado del
 * servidor (además de comprobar que es parte del pedido): acá no se decide nada
 * de eso. Un botón, un tipo, misma bandeja del admin que las incidencias del
 * repartidor.
 *
 * `onTrigger` existe para cerrar el diálogo de detalle del pedido antes de abrir
 * este: dos diálogos abiertos a la vez pelean por el foco y por el scroll del
 * fondo. El dueño del diálogo de detalle decide cerrarlo.
 */
export function RestaurantPaymentIssueButton({
  orderId,
  onTrigger,
}: {
  orderId: string
  /** Se llama al abrir el reporte (para cerrar el diálogo de detalle). */
  onTrigger?: () => void
}) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full"
        onClick={() => {
          onTrigger?.()
          setOpen(true)
        }}
      >
        Reportar problema con el pago
      </Button>

      <PaymentIncidentDialog
        open={open}
        onOpenChange={setOpen}
        orderId={orderId}
        kinds={['RESTAURANT_NOT_PAID']}
        title="Reportar problema con el pago"
        description="Registra que el pago de la comida no llegó o no figura. El admin lo revisa con el repartidor."
        submitLabel="Enviar reporte"
        successTitle="Registramos tu reporte."
        successDescription="Soporte lo revisará con el repartidor."
      />
    </>
  )
}
