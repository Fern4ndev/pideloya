'use client'

import { useId, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { sendDeliveryOffer } from '@/lib/actions/deliveries'
import {
  DEFAULT_DELIVERY_FEE,
  suggestedDeliveryFee,
} from '@/lib/validations/delivery-offer'
import { formatDistanceKm } from '@/lib/geo/distance'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/toast'

/**
 * Oferta de envío: el repartidor propone cuánto cobra por llevar el pedido.
 * Reemplaza al antiguo botón "Aceptar" plano — el pedido ya no se acepta sin
 * precio, se oferta.
 *
 * El input arranca con la tarifa sugerida por distancia (`suggestedDeliveryFee`)
 * y, si no se conoce la distancia, con el default de siempre. Es un PUNTO DE
 * PARTIDA, no un valor impuesto: el repartidor lo cambia con dos toques, y el
 * valor se calcula una sola vez (`useState` con inicializador) para no pisarle
 * lo que escribió si la lista se revalida mientras decide.
 */
export function SendOfferForm({
  orderId,
  distanceKm = null,
}: {
  orderId: string
  /** Distancia en línea recta negocio → cliente, o `null` si falta ubicación. */
  distanceKm?: number | null
}) {
  const inputId = useId()
  const router = useRouter()
  const [fee, setFee] = useState(() =>
    String(distanceKm === null ? DEFAULT_DELIVERY_FEE : suggestedDeliveryFee(distanceKm))
  )
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
        {/* La distancia al lado del precio: es el dato con el que se decide la
            tarifa, así que no tiene sentido esconderlo en otra tarjeta. */}
        {distanceKm !== null && (
          <span className="ml-1 text-muted-foreground/80 tabular-nums">
            · ≈ {formatDistanceKm(distanceKm)}
          </span>
        )}
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
    </form>
  )
}
