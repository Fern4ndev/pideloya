'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ShieldCheckIcon } from 'lucide-react'
import {
  verifyUpfrontPayment,
  rejectUpfrontPayment,
} from '@/lib/actions/deliveries'
import { PaymentVoucherViewer } from '@/components/features/orders/PaymentVoucherViewer'
import { ConfirmDialog } from '@/components/features/admin/ConfirmDialog'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'

/**
 * Verifica el Yape ANTES de ir al negocio: el cliente ya subió su comprobante
 * y el pedido sigue en AWAITING_PAYMENT hasta que el repartidor lo aprueba.
 *
 * El monto esperado es EL dato de la tarjeta (comida + envío, D1): es lo que
 * el comprobante "debe decir". Sin ese número al lado de la imagen, verificar
 * obligaría a memorizar el total de otra tarjeta.
 *
 * Dos salidas y ninguna trampa: "Confirmar pago" avanza a ASSIGNED; "Rechazar"
 * pide confirmación explícita (devuelve el pedido al pool) porque es
 * destructiva. Sin la salida de rechazo, un comprobante malo dejaría al
 * repartidor atrapado en una entrega que no puede avanzar.
 */
export function VerifyUpfrontPaymentPanel({
  orderId,
  foodAmount,
  deliveryFee,
  voucherUrl,
}: {
  orderId: string
  /** Comida (orders.total). */
  foodAmount: number
  /** Envío (deliveries.delivery_fee). */
  deliveryFee: number
  /** URL firmada del comprobante que subió el cliente. */
  voucherUrl: string
}) {
  const router = useRouter()
  const { success, error } = useToast()
  const [isPending, startTransition] = useTransition()
  const [rejectOpen, setRejectOpen] = useState(false)

  const expected = foodAmount + deliveryFee

  function handleVerify() {
    startTransition(async () => {
      try {
        await verifyUpfrontPayment(orderId)
        success('Pago verificado. Ve por el pedido.')
        router.refresh()
      } catch (err) {
        error('No se pudo verificar', err instanceof Error ? err.message : undefined)
      }
    })
  }

  return (
    <section
      aria-labelledby="verify-payment-heading"
      className="w-full min-w-0 rounded-2xl border border-brand-500/40 bg-brand-500/[0.06] p-4"
    >
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-500/15 text-brand-600">
          <ShieldCheckIcon className="h-4 w-4" aria-hidden />
        </span>
        <div className="min-w-0">
          <h2 id="verify-payment-heading" className="text-sm font-semibold">
            Verifica el pago por Yape
          </h2>
          <p className="text-xs text-muted-foreground">
            El comprobante debe decir este monto antes de ir al negocio.
          </p>
        </div>
      </div>

      {/* Monto esperado GRANDE y tabular: es lo que se contrasta de un vistazo
          con la captura, y el desglose evita la disputa "¿el envío estaba
          incluido?". */}
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <PaymentVoucherViewer
          url={voucherUrl}
          alt="Comprobante de pago por Yape del cliente"
          thumbnailClassName="h-24 w-24"
          actionLabel="Ver en grande"
        />
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">Debe decir</p>
          <p className="text-3xl font-bold tabular-nums">
            S/ {expected.toFixed(2)}
          </p>
          <p className="mt-0.5 text-xs tabular-nums text-muted-foreground">
            Comida S/ {foodAmount.toFixed(2)} + Envío S/ {deliveryFee.toFixed(2)}
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <Button
          variant="lime"
          className="h-11 flex-1"
          disabled={isPending}
          onClick={handleVerify}
        >
          {isPending ? 'Verificando…' : 'Confirmar pago e ir al negocio'}
        </Button>
        <Button
          variant="outline"
          className="h-11 text-destructive hover:text-destructive"
          disabled={isPending}
          onClick={() => setRejectOpen(true)}
        >
          Rechazar
        </Button>
      </div>

      <ConfirmDialog
        open={rejectOpen}
        onOpenChange={setRejectOpen}
        title="¿Rechazar este comprobante?"
        description={`El pedido esperaba S/ ${expected.toFixed(2)} por Yape. Volverá a estar disponible para otros repartidores y el cliente tendrá que esperar una nueva oferta.`}
        confirmLabel="Rechazar comprobante"
        onConfirm={async () => rejectUpfrontPayment(orderId)}
      />
    </section>
  )
}
