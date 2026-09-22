'use client'

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
import { CheckIcon, ClockIcon, EyeIcon, MapPinIcon, StoreIcon } from 'lucide-react'
import type { OrderStatus } from '@/lib/constants/order-status'

export type DeliveryDetail = {
  id: string
  restaurantName: string
  items: { productName: string | null; quantity: number }[]
  addressText: string
  status: OrderStatus
  total: number
  acceptedAt: string | null
  deliveredAt: string | null
}

function formatDateTime(value: string | null) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('es-PE', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function DeliveryDetailsDialog({ delivery }: { delivery: DeliveryDetail }) {
  return (
    <Dialog>
      <DialogTrigger render={<Button variant="ghost" size="icon-sm" title="Ver detalle" />}>
        <EyeIcon className="h-4 w-4" />
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Detalle de la entrega</DialogTitle>
          <DialogDescription>Revisa lo pedido y las horas de la entrega.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <StoreIcon className="h-4 w-4" />
              </span>
              <div>
                <p className="text-sm font-medium">{delivery.restaurantName}</p>
                <p className="text-xs text-muted-foreground">
                  S/ {Number(delivery.total).toFixed(2)}
                </p>
              </div>
            </div>
            <OrderStatusBadge status={delivery.status} />
          </div>

          <div>
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">Lo pedido</p>
            <ul className="space-y-1.5">
              {delivery.items.map((item) => (
                <li
                  key={`${item.productName}-${item.quantity}`}
                  className="flex items-center justify-between gap-3 rounded-xl bg-muted/50 px-3 py-2 text-sm"
                >
                  <span className="min-w-0 flex-1 truncate">
                    {item.productName ?? 'Producto'}
                  </span>
                  <span className="shrink-0 font-medium tabular-nums">x{item.quantity}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex items-start gap-2 text-sm">
            <MapPinIcon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <span>{delivery.addressText}</span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="flex items-center gap-2 rounded-xl bg-muted/50 px-3 py-2.5">
              <ClockIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Aceptado</p>
                <p className="truncate text-sm font-medium tabular-nums">
                  {formatDateTime(delivery.acceptedAt)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-xl bg-muted/50 px-3 py-2.5">
              <CheckIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Entregado</p>
                <p className="truncate text-sm font-medium tabular-nums">
                  {formatDateTime(delivery.deliveredAt)}
                </p>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}