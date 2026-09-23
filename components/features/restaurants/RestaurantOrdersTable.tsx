import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { OrderDetailsDialog, type OrderDetail } from '@/components/features/orders/OrderDetailsDialog'

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  PENDING: 'outline',
  ASSIGNED: 'secondary',
  PICKED_UP: 'secondary',
  ON_THE_WAY: 'secondary',
  DELIVERED: 'default',
  CANCELLED: 'destructive',
}

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pendiente',
  ASSIGNED: 'Asignado',
  PICKED_UP: 'Recogido',
  ON_THE_WAY: 'En camino',
  DELIVERED: 'Entregado',
  CANCELLED: 'Cancelado',
}

export function RestaurantOrdersTable({
  orders,
  startIndex,
}: {
  orders: OrderDetail[]
  startIndex: number
}) {
  if (orders.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
        No hay pedidos registrados aún.
      </div>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-12">N°</TableHead>
          <TableHead>Items</TableHead>
          <TableHead>Estado</TableHead>
          <TableHead className="text-right">Total</TableHead>
          <TableHead className="text-right">Fecha</TableHead>
          <TableHead className="text-center">Acciones</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {orders.map((order, index) => {
          const itemsText = order.items
            .map((i) => `${i.quantity}x ${i.productName ?? 'Producto'}`)
            .join(', ')
          const createdAt = new Date(order.createdAt)

          return (
            <TableRow key={order.id}>
              <TableCell className="tabular-nums text-muted-foreground">
                {startIndex + index + 1}
              </TableCell>
              <TableCell className="max-w-[200px] truncate text-muted-foreground">
                {itemsText || '—'}
              </TableCell>
              <TableCell>
                <Badge variant={STATUS_VARIANT[order.status] ?? 'outline'}>
                  {STATUS_LABELS[order.status] ?? order.status}
                </Badge>
              </TableCell>
              <TableCell className="text-right font-medium">
                S/ {order.total.toFixed(2)}
              </TableCell>
              <TableCell className="text-right text-muted-foreground">
                {createdAt.toLocaleDateString('es-PE', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                })}
              </TableCell>
              <TableCell>
                <div className="flex justify-center">
                  <OrderDetailsDialog order={order} />
                </div>
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}
