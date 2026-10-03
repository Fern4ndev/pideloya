'use client'

import { useTransition } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import { advanceOrderStatus } from '@/lib/actions/deliveries'
import type { PaymentTiming } from '@/lib/constants/payment-method'

/**
 * Diálogo al pasar ASSIGNED → PICKED_UP: el repartidor declara si ya le pagó la
 * comida al restaurante mientras recoge el pedido.
 *
 * Es la respuesta directa a la observación que abre el plan: con pago al
 * recibir, el repartidor ADELANTA la comida con su propio dinero, y esa
 * operación era invisible. El botón primario deja la constancia
 * `orders.restaurant_paid_at` (D6); el secundario existe porque forzar la
 * declaración empujaría a marcar falso — hay casos legítimos (cortesía,
 * restaurante que factura aparte) y se permite "recoger sin pagar" sin bloqueo.
 *
 * El cuerpo son DOS líneas y una sola frase: en ON_DELIVERY nombra el adelanto
 * con su monto (el repartidor decide con el riesgo a la vista); en UPFRONT se
 * omite, porque el dinero ya es del cliente.
 *
 * Reutiliza el patrón ConfirmDialog, pero con su propio componente porque tiene
 * DOS acciones positivas y un cuerpo condicional que ConfirmDialog no modela.
 */
export function PickupDialog({
  open,
  onOpenChange,
  orderId,
  restaurantName,
  foodAmount,
  timing,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  orderId: string
  /** Nombre del restaurante donde recoge. */
  restaurantName: string
  /** Comida (orders.total): lo que le paga al restaurante. */
  foodAmount: number
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
          restaurantPaid
            ? 'Pedido recogido · pago al restaurante registrado'
            : 'Pedido recogido'
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
          <DialogTitle>¿Pagaste S/ {foodAmount.toFixed(2)} en {restaurantName}?</DialogTitle>
          {timing === 'ON_DELIVERY' && (
            <DialogDescription>
              Adelantas S/ {foodAmount.toFixed(2)}; el cliente te los devuelve al
              entregar.
            </DialogDescription>
          )}
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
            Recoger sin pagar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
