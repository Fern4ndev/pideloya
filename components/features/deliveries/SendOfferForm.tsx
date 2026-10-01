'use client'

import { useId, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { sendDeliveryOffer } from '@/lib/actions/deliveries'
import { DEFAULT_DELIVERY_FEE } from '@/lib/validations/delivery-offer'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/toast'

/**
 * Oferta de envío: el repartidor ve la dirección de entrega (en la tarjeta
 * del pedido, arriba de este formulario) y propone libremente cuánto cobra
 * por llevarlo — sin ninguna sugerencia automática. El input arranca en
 * DEFAULT_DELIVERY_FEE (S/ 5) como punto de partida neutral, no como
 * recomendación: el repartidor lo cambia con dos toques según su propio
 * criterio (tráfico, hora, cuán conocida es la zona, etc.).
 *
 * Fase 7 (D7): la línea bajo el formulario recuerda qué implica ofertar según
 * su preferencia — si acepta pago al recibir, el importe de la comida que
 * adelanta; si no, que este pedido solo admitirá pago por adelantado. Se
 * recibe por props y no se lee de la sesión acá para no duplicar consulta: la
 * página ya cargó el perfil.
 */
export function SendOfferForm({
  orderId,
  acceptsPayOnDelivery,
  foodAmount,
}: {
  orderId: string
  /** Snapshot que quedará en la oferta: viene de `profiles.accepts_pay_on_delivery`. */
  acceptsPayOnDelivery: boolean
  /** `orders.total` = lo que el repartidor adelantaría al restaurante. */
  foodAmount: number
}) {
  const inputId = useId()
  const router = useRouter()
  const [fee, setFee] = useState(String(DEFAULT_DELIVERY_FEE))
  const [isPending, startTransition] = useTransition()
  const { error, success } = useToast()

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    startTransition(async () => {
      try {
        await sendDeliveryOffer(orderId, { deliveryFee: Number(fee) })
        success('Oferta enviada', 'Te avisaremos cuando el cliente confirme el pago.')
        // Navegar (y no solo refrescar) es intencional: el pedido sale de
        // "Disponibles" en cuanto queda en AWAITING_PAYMENT, así que el
        // repartidor tiene que poder verlo donde ahora vive — "Mis entregas",
        // con su badge de espera y la opción de retirar la oferta. Mismo
        // criterio que el antiguo botón "Aceptar".
        router.push('/repartidor/pedidos')
      } catch (err) {
        error('No se pudo enviar la oferta', err instanceof Error ? err.message : undefined)
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-center gap-2">
      <label htmlFor={inputId} className="text-sm text-muted-foreground">
        Tarifa de envío
      </label>
      <div className="relative w-24">
        <span
          aria-hidden
          className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground"
        >
          S/
        </span>
        <Input
          id={inputId}
          type="number"
          inputMode="decimal"
          step="0.5"
          min="1"
          max="30"
          required
          value={fee}
          onChange={(event) => setFee(event.target.value)}
          className="pl-7 tabular-nums"
        />
      </div>
      {/* Tamaño default (h-8) y no `sm`: así el botón coincide en alto con el
          input de al lado. Un input y un botón pegados con alturas distintas
          es el detalle que más se nota en un formulario de una sola línea. */}
      <Button type="submit" variant="lime" disabled={isPending}>
        {isPending ? 'Enviando…' : 'Enviar oferta'}
      </Button>
      <p className="w-full text-xs text-muted-foreground">
        {acceptsPayOnDelivery ? (
          <>
            Aceptas pago al recibir (adelantas S/ {foodAmount.toFixed(2)} de comida)
          </>
        ) : (
          'Solo cobras por adelantado'
        )}
      </p>
    </form>
  )
}
