'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { ExpandIcon } from 'lucide-react'
import { confirmDeliveryPayment } from '@/lib/actions/orders'
import { DeliveryAvatar } from '@/components/features/admin/DeliveryAvatar'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog'
import { useToast } from '@/components/ui/toast'

export type DeliveryOffer = {
  fullName: string
  avatarUrl: string | null
  yapeQrUrl: string | null
  deliveryFee: number
}

/**
 * Tarjeta de pago del envío: aparece SOLO cuando el pedido está en
 * AWAITING_PAYMENT, es decir cuando ya hay un repartidor con una tarifa
 * propuesta esperando que el cliente le pague por Yape.
 *
 * Tres decisiones de diseño que no son cosméticas:
 *
 * 1. El aviso de "no verificamos el pago automáticamente" está a la vista.
 *    No hay pasarela integrada: el dinero se mueve por fuera de la app, y el
 *    botón es una confirmación de buena fe. Decirlo evita que el cliente
 *    asuma una garantía que la plataforma no puede dar.
 * 2. El QR es tocable para verlo en grande. Escanear un QR de 160px desde el
 *    celular de al lado funciona a duras penas; en grande, siempre.
 * 3. Los tokens son ámbar — el lenguaje de "esperando algo de alguien" que el
 *    proyecto ya usa en los banners de negocio cerrado y de pedido buscando
 *    repartidor — y no un color nuevo.
 */
export function DeliveryPaymentCard({
  orderId,
  deliveryPerson,
}: {
  orderId: string
  deliveryPerson: DeliveryOffer
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const { error, success } = useToast()
  const fee = deliveryPerson.deliveryFee.toFixed(2)

  function handleConfirm() {
    startTransition(async () => {
      try {
        await confirmDeliveryPayment(orderId)
        success('¡Listo! Tu repartidor ya puede ir por tu pedido.')
        // El pedido pasa a ASSIGNED: la Server Action revalida la ruta, y el
        // refresh explícito asegura que esta tarjeta desaparezca de la vista
        // en el mismo instante (no solo el timeline).
        router.refresh()
      } catch (err) {
        error('No se pudo confirmar', err instanceof Error ? err.message : undefined)
      }
    })
  }

  return (
    <section
      aria-labelledby="delivery-payment-heading"
      className="rounded-3xl border border-amber-300/60 bg-amber-50/60 p-5 dark:border-amber-500/30 dark:bg-amber-500/10"
    >
      <div className="flex items-center gap-3">
        <DeliveryAvatar
          url={deliveryPerson.avatarUrl}
          name={deliveryPerson.fullName}
          size="lg"
          className="h-14 w-14 ring-2 ring-white dark:ring-neutral-900"
        />
        <div className="min-w-0">
          <h2 id="delivery-payment-heading" className="text-sm font-medium">
            {deliveryPerson.fullName} llevará tu pedido
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Costo de envío:{' '}
            <span className="font-semibold text-foreground">S/ {fee}</span>
          </p>
        </div>
      </div>

      {deliveryPerson.yapeQrUrl ? (
        <Dialog>
          <DialogTrigger
            render={
              <button
                type="button"
                className="mt-4 flex w-full flex-col items-center gap-1 rounded-2xl border border-black/5 bg-white p-3 transition-colors hover:border-amber-400/60 dark:border-white/10 dark:bg-white/5"
              />
            }
          >
            <span className="relative block h-40 w-40">
              <Image
                src={deliveryPerson.yapeQrUrl}
                alt="QR de Yape del repartidor"
                fill
                sizes="160px"
                className="object-contain"
              />
            </span>
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <ExpandIcon className="h-3.5 w-3.5" aria-hidden />
              Toca para ampliarlo
            </span>
          </DialogTrigger>
          <DialogContent className="flex flex-col items-center gap-3 sm:max-w-xs">
            <span className="relative block h-72 w-72">
              <Image
                src={deliveryPerson.yapeQrUrl}
                alt="QR de Yape del repartidor"
                fill
                sizes="288px"
                className="object-contain"
              />
            </span>
            <p className="text-center text-sm text-muted-foreground">
              Escanéalo y transfiere S/ {fee} por Yape.
            </p>
          </DialogContent>
        </Dialog>
      ) : (
        // Degradación con gracia (checklist de la Fase 8): un repartidor sin
        // QR cargado no rompe la tarjeta — se le dice al cliente que confirme
        // solo si ya acordaron el medio de pago.
        <p className="mt-4 rounded-2xl border border-dashed border-amber-400/60 px-4 py-3 text-xs text-muted-foreground">
          {deliveryPerson.fullName} todavía no cargó su QR de Yape. Confirma el
          pago únicamente si ya acordaron cómo transferirle.
        </p>
      )}

      <p className="mt-3 text-xs text-muted-foreground">
        Escanea el QR y paga <span className="font-semibold">S/ {fee}</span> por
        Yape. Cuando lo hayas hecho, confirma abajo: no verificamos el pago
        automáticamente, así que confirma solo si ya transferiste.
      </p>

      <Button
        className="mt-4 w-full rounded-full"
        onClick={handleConfirm}
        disabled={isPending}
      >
        {isPending ? 'Confirmando…' : 'Ya pagué, confirmar'}
      </Button>
    </section>
  )
}
