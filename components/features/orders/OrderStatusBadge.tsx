import { Badge } from '@/components/ui/badge'
import { ORDER_STATUS_LABELS, type OrderStatus } from '@/lib/constants/order-status'

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const label = ORDER_STATUS_LABELS[status] ?? status

  if (status === 'CANCELLED') {
    return <Badge variant="destructive">{label}</Badge>
  }
  if (status === 'DELIVERED') {
    return <Badge variant="secondary">{label}</Badge>
  }
  if (status === 'PENDING') {
    return <Badge variant="outline">{label}</Badge>
  }
  return <Badge>{label}</Badge>
}