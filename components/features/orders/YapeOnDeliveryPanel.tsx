'use client'

import Image from 'next/image'
import { CopyButton } from '@/components/ui/copy-button'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { ExpandIcon } from 'lucide-react'
import { formatPePhone } from '@/lib/format/phone'
import { PAYMENT_METHOD_LOCK_NOTICE } from '@/lib/constants/payment-method'

/**
 * Panel del pago por Yape AL RECIBIR (nuevo camino de la Fase 4): el cliente
 * ANUNCIA que yapeará cuando el repartidor le entregue el pedido.
 *
 * Diferencias con `YapePaymentPanel` (el de "pagar ahora"), todas de fondo y no
 * de estilo:
 *
 * 1. **Sin comprobante** (D5): en la puerta lo que existe es la app de Yape del
 *    repartidor, no una captura previa. El picker no existe acá ni por error.
 * 2. **Sin diálogo de confirmación extra**: la decisión ya se anunció; el
 *    LockNotice viaja visible antes del clic, igual que en los otros paneles.
 * 3. **El QR va en vista previa pequeña y tocable** (patrón ya validado): el
 *    cliente puede PREPARAR su Yape —guardar el contacto, ver que tiene
 *    saldo— antes de que llegue el repartidor.
 * 4. El monto es SIEMPRE comida + envío (D1 unificado): le paga el total al
 *    repartidor, que adelantó la comida al recogerla.
 *
 * Componente de presentación: no sube nada, no llama acciones. El CTA delega
 * en el padre, que es quien conoce `busy` y la fase.
 */
export function YapeOnDeliveryPanel({
  fullName,
  yapeQrUrl,
  phone,
  amount,
  busy,
  onConfirm,
}: {
  fullName: string
  yapeQrUrl: string | null
  /** Celular crudo del repartidor (9 dígitos) o null si no lo registró. */
  phone: string | null
  /** Monto total a pagarle al repartidor, ya formateado (ej. "27.50"). */
  amount: string
  busy: boolean
  onConfirm: () => void
}) {
  const digits = phone?.replace(/\D/g, '') ?? ''

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-black/5 bg-white p-4 dark:border-white/10 dark:bg-white/5">
        <p className="text-xs text-amber-900 dark:text-amber-100">
          Le pagarás a {fullName} al recibir
        </p>
        {/* Monto grande y tabular: el mismo dato que el repartidor va a exigir
            en la puerta y que acá queda como promesa registrada. */}
        <p className="mt-1 text-2xl font-semibold tabular-nums">S/ {amount}</p>
        <p className="mt-1 text-xs text-amber-900 dark:text-amber-100">
          Comida + envío. Yapeas cuando te entregue el pedido.
        </p>
      </div>

      {/* Vista previa pequeña del QR del repartidor, tocable para ampliarlo
          (mismo patrón que el panel de Yape por adelantado). Si no hay QR, el
          número pasa a ser la vía; si tampoco hay, el aviso dice la verdad sin
          bloquear: el cobro coordinado igual se registra. */}
      {yapeQrUrl ? (
        <Dialog>
          <DialogTrigger
            render={
              <button
                type="button"
                className="flex w-full flex-col items-center gap-1 rounded-2xl border border-black/5 bg-white p-3 transition-colors hover:border-amber-400/60 dark:border-white/10 dark:bg-white/5"
              />
            }
          >
            <span className="relative block h-40 w-40 max-w-full">
              <Image
                src={yapeQrUrl}
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
          <DialogContent className="flex flex-col items-center gap-3 bg-white text-neutral-900 sm:max-w-xs">
            {/* `aspect-square` + `max-w-full`: a 360 px el QR se encoge en vez de
                desbordar el diálogo (con `h-72 w-72` fijos se salía del padding). */}
            <span className="relative block aspect-square w-72 max-w-full">
              <Image
                src={yapeQrUrl}
                alt="QR de Yape del repartidor"
                fill
                sizes="288px"
                className="object-contain"
              />
            </span>
            <DialogTitle className="text-center text-sm font-normal text-neutral-600">
              Escanéalo y prepara tu Yape: transfiere S/ {amount} cuando te entregue.
            </DialogTitle>
          </DialogContent>
        </Dialog>
      ) : (
        <p className="rounded-2xl border border-dashed border-amber-400/60 px-4 py-3 text-xs text-amber-900 dark:text-amber-100">
          {digits
            ? `${fullName} todavía no cargó su QR de Yape. Podrás yapearle al número de abajo cuando te entregue.`
            : `${fullName} todavía no cargó su QR de Yape ni tiene un número registrado. Coordinen el pago al recibir.`}
        </p>
      )}

      {digits && (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-black/5 bg-white p-3 dark:border-white/10 dark:bg-white/5">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">
              {yapeQrUrl ? 'O yapea a este número' : 'Yapea a este número'}
            </p>
            <p className="select-all text-lg font-semibold tabular-nums tracking-wide">
              {formatPePhone(digits)}
            </p>
          </div>
          <CopyButton value={digits} label="número del repartidor" />
        </div>
      )}

      <Button
        type="button"
        onClick={onConfirm}
        disabled={busy}
        className="h-11 w-full rounded-full"
      >
        {busy ? 'Confirmando…' : 'Confirmar: pagaré por Yape al recibir'}
      </Button>

      <p className="text-center text-xs text-amber-900 dark:text-amber-100">
        {PAYMENT_METHOD_LOCK_NOTICE}
      </p>
    </div>
  )
}
