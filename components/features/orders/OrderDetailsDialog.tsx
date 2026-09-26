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

export function OrderDetailsDialog({ order }: { order: OrderDetail }) {
  return (
    <Dialog>
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
        </div>
      </DialogContent>
    </Dialog>
  )
}