'use client'

import { BanknoteIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PAYMENT_METHOD_LOCK_NOTICE } from '@/lib/constants/payment-method'

/**
 * Panel del pago en efectivo: aparece SOLO después de que el cliente elige
 * "Pagar al recibir".
 *
 * (D1) El monto que se muestra es el TOTAL del pedido (comida + envío), no la
 * tarifa del repartidor: es lo que el cliente le va a entregar en la mano. Va
 * en `text-2xl` y tabular porque es EL dato que tiene que ir a buscar a su
 * billetera; y se explica de dónde sale ("comida + envío") para que nadie
 * descubra el monto real recién al recibir.
 *
 * Sin diálogo de confirmación extra (a diferencia del cobro del repartidor, que
 * sí lo lleva): acá el cliente solo se COMPROMETE a pagar; el dinero todavía no
 * se mueve y el aviso de irrevocabilidad (D3) ya está visible antes del clic.
 * Pedir "¿estás seguro?" sobre una decisión reversible-pero-anunciada es un paso
 * de más que se paga en fricción y en clics accidentales.
 */
export function CashPaymentPanel({
  amount,
  onConfirm,
  busy,
}: {
  /** Monto a entregar, ya formateado con dos decimales (ej. "27.50"). */
  amount: string
  onConfirm: () => void
  busy: boolean
}) {
  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-black/5 bg-white p-4 dark:border-white/10 dark:bg-white/5">
        <p className="flex items-center gap-1.5 text-xs text-amber-900 dark:text-amber-100">
          <BanknoteIcon className="h-3.5 w-3.5" aria-hidden />
          Le pagarás al repartidor
        </p>
        <p className="mt-1 text-2xl font-semibold tabular-nums">S/ {amount}</p>
        <p className="mt-1 text-xs text-amber-900 dark:text-amber-100">
          En efectivo, cuando te entregue el pedido. Cubre la comida y el envío; si puedes, ten
          el monto exacto.
        </p>
      </div>

      <Button
        type="button"
        onClick={onConfirm}
        disabled={busy}
        className="h-11 w-full rounded-full"
      >
        {busy ? 'Confirmando…' : 'Confirmar pago en efectivo'}
      </Button>

      <p className="text-center text-xs text-amber-900 dark:text-amber-100">
        {PAYMENT_METHOD_LOCK_NOTICE}
      </p>
    </div>
  )
}
