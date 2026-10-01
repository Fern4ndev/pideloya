'use client'

import { useTransition } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import { advanceOrderStatus } from '@/lib/actions/deliveries'
import type { PaymentTiming } from '@/lib/constants/payment-method'

/**
 * Diálogo al pasar ASSIGNED → PICKED_UP (Fase 5): el repartidor declara si ya
 * le pagó la comida al restaurante mientras recoge el pedido.
 *
 * Es la respuesta directa a la observación que abre el plan: con pago al
 * recibir, el repartidor ADELANTA la comida con su propio dinero, y esa
 * operación era invisible. El botón primario deja la constancia
 * `orders.restaurant_paid_at` (D6); el secundario existe porque forzar la
 * declaración empujaría a marcar falso — hay casos legítimos (cortesía,
 * restaurante que factura aparte) y se permite "recoger sin pagar" sin
 * bloqueo.
 *
 * El cuerpo cambia según el timing (D1): en ON_DELIVERY se NOMBRA el adelanto
 * con su monto — el repartidor decide con el riesgo a la vista; en UPFRONT el
 * dinero ya es del cliente y solo se recuerda cuánto pagar.
 *
 * Reutiliza el patrón ConfirmDialog (variante default: pagar y recoger es el
 * cierre normal del paso, no una acción de la que haya que disuadir), pero con
 * su propio componente porque tiene DOS acciones positivas y un cuerpo
 * condicional que ConfirmDialog no modela.
 */
export function PickupDialog({
  open,
  onOpenChange,
  orderId,
  restaurantName,
  foodAmount,
  totalAmount,
  timing,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  orderId: string
  /** Nombre del restaurante donde recoge. */
  restaurantName: string
  /** Comida (orders.total): lo que le paga al restaurante. */
  foodAmount: number
  /** Total comida + envío: lo que el cliente le devolverá al entregar. */
  totalAmount: number
  /** Snapshot del pedido; solo ON_DELIVERY implica adelanto propio. */
  timing: PaymentTiming | null
}) {
  const [isPending, startTransition] = useTransition()
  const { success, error } = useToast()

  function advance(restaurantPaid: boolean) {
    if (isPending) return
    startTransition(async () => {
      try {
        await advanceOrderStatus(orderId, 'ASSIGNED', { restaurantPaid })
        onOpenChange(false)
        success(
          'Pedido recogido',
          restaurantPaid
            ? 'Quedó registrada tu constancia de pago al restaurante.'
            : 'El pedido avanzó sin registrar pago al restaurante.'
        )
      } catch (err) {
        error('No se pudo avanzar', err instanceof Error ? err.message : undefined)
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>¿Pagaste el pedido en {restaurantName}?</DialogTitle>
          <DialogDescription>
            {timing === 'ON_DELIVERY' ? (
              <>
                Estás adelantando{' '}
                <span className="font-semibold tabular-nums">S/ {foodAmount.toFixed(2)}</span> de
                tu dinero. El cliente te lo devolverá al entregar (S/ {totalAmount.toFixed(2)} en
                total).
              </>
            ) : (
              <>
                Usa el dinero que el cliente ya te transfirió. Paga{' '}
                <span className="font-semibold tabular-nums">S/ {foodAmount.toFixed(2)}</span> al
                restaurante.
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="sm:flex-col sm:items-stretch">
          <Button variant="lime" onClick={() => advance(true)} disabled={isPending}>
            {isPending ? 'Confirmando…' : 'Sí, pagué y recogí'}
          </Button>
          {/* Secundario en texto (no lleno): existe para casos raros y NO para
              empujar el camino fácil — por eso no compite en peso visual. */}
          <Button
            variant="ghost"
            onClick={() => advance(false)}
            disabled={isPending}
            className="text-muted-foreground"
          >
            Recoger sin pagar (ya estaba pagado)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
