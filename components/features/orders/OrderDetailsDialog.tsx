'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { OrderStatusBadge } from '@/components/features/orders/OrderStatusBadge'
import { RestaurantPaymentIssueButton } from '@/components/features/orders/RestaurantPaymentIssueButton'
import { CalendarIcon, EyeIcon } from 'lucide-react'
import type { OrderStatus } from '@/lib/constants/order-status'

export type OrderDetailItem = {
  productName: string | null
  quantity: number
  unitPrice: number
}

export type OrderDetail = {
  id: string
  items: OrderDetailItem[]
  status: OrderStatus
  total: number
  createdAt: string
  /** Constancia D6: cuándo el repartidor declaró haber pagado la comida.
   * null = sin registro todavía (el restaurante lo concilia con esto). */
  restaurantPaidAt?: string | null
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleDateString('es-PE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString('es-PE', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * Texto del estado del cobro de la comida al restaurante (Fase 6). Módulo
 * compartido por la tabla y el detalle: un solo lugar para la regla de los
 * cuatro estados — un texto que cambia de significado entre tablas es la misma
 * mentira que un método desincronizado.
 */
export function RestaurantPaymentText({
  status,
  restaurantPaidAt,
}: {
  status: OrderStatus
  restaurantPaidAt: string | null
}) {
  if (restaurantPaidAt) {
    return (
      <span className="text-right font-medium text-emerald-700 dark:text-emerald-400">
        Pagado por el repartidor · {formatTime(restaurantPaidAt)}
      </span>
    )
  }

  // Constancia esperada y no llegada: distinguir "aún no" de "algo falló".
  if (status === 'PICKED_UP' || status === 'ON_THE_WAY') {
    return (
      <span className="text-right font-medium text-amber-700 dark:text-amber-400">
        Pago pendiente de confirmar
      </span>
    )
  }
  if (status === 'ASSIGNED') {
    return <span className="text-right text-muted-foreground">El repartidor pagará al recoger</span>
  }
  if (status === 'DELIVERED') {
    return <span className="text-right text-muted-foreground">Sin registro de pago</span>
  }
  return <span className="text-right text-muted-foreground">—</span>
}

/**
 * Estados en los que ya tiene sentido reclamar el pago de la comida: el pedido
 * arrancó (el repartidor debía pagar al recoger) o ya se entregó sin constancia.
 * Antes de ASSIGNED no hay nada que reclamar y solo generaría ruido en la
 * bandeja del admin.
 */
function canReportPaymentIssue(order: OrderDetail) {
  if (order.restaurantPaidAt) return false
  return (
    order.status === 'ASSIGNED' ||
    order.status === 'PICKED_UP' ||
    order.status === 'ON_THE_WAY' ||
    order.status === 'DELIVERED'
  )
}

export function OrderDetailsDialog({ order }: { order: OrderDetail }) {
  // Controlado para poder cerrar el detalle antes de abrir el diálogo de
  // incidencia (Fase 8.4): dos diálogos abiertos a la vez pelean por el foco.
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="ghost" size="icon-sm" title="Ver detalle" />}>
        <EyeIcon className="h-4 w-4" />
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Detalle del pedido</DialogTitle>
          <DialogDescription>Revisa lo pedido y su estado actual.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <ul className="space-y-1.5">
            {order.items.map((item, index) => (
              <li
                key={`${item.productName}-${index}`}
                className="flex items-center justify-between gap-3 rounded-xl bg-muted/50 px-3 py-2 text-sm"
              >
                <span className="min-w-0 flex-1 truncate">
                  {item.productName ?? 'Producto'}
                  <span className="ml-1.5 text-muted-foreground">x{item.quantity}</span>
                </span>
                <span className="shrink-0 font-medium tabular-nums">
                  S/ {(item.unitPrice * item.quantity).toFixed(2)}
                </span>
              </li>
            ))}
          </ul>

          <div className="flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-sm">
            <span className="font-medium">Total</span>
            <span className="font-semibold tabular-nums">
              S/ {Number(order.total).toFixed(2)}
            </span>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className="flex items-center gap-2 text-muted-foreground">
              <CalendarIcon className="h-4 w-4 shrink-0" />
              {formatDateTime(order.createdAt)}
            </span>
            <OrderStatusBadge status={order.status} />
          </div>

          {/* Fase 6: la fila "Cobro de la comida" con la MISMA lógica que la
              columna "Pago" de la tabla — texto, nunca solo color, porque es
              la constancia de un dinero que el restaurante no ve pasar por la
              app. Mínimo privilegio: solo SI y CUÁNDO se le pagó, sin método
              del cliente ni datos del repartidor. */}
          <div className="flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-sm">
            <span className="font-medium">Cobro de la comida</span>
            <RestaurantPaymentText status={order.status} restaurantPaidAt={order.restaurantPaidAt ?? null} />
          </div>

          {/* Fase 8.4: solo aparece cuando hay algo que reclamar (el pedido ya
              arrancó y la constancia de pago no llegó). Entra a la misma bandeja
              del admin que las incidencias del repartidor. */}
          {canReportPaymentIssue(order) && (
            <RestaurantPaymentIssueButton
              orderId={order.id}
              onTrigger={() => setOpen(false)}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}