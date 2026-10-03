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
  // Ámbar = "esperando algo de alguien", el mismo lenguaje que el banner de
  // pedido buscando repartidor y el de negocio cerrado. Se distingue de
  // PENDING (neutro) a propósito: acá hay una acción pendiente del usuario,
  // no una espera pasiva del sistema.
  if (status === 'AWAITING_PAYMENT') {
    return (
      <Badge
        variant="outline"
        className="border-amber-300/70 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200"
      >
        {label}
      </Badge>
    )
  }
  return <Badge>{label}</Badge>
}