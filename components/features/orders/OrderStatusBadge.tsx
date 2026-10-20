import { Badge } from '@/components/ui/badge'
import {
  ORDER_STATUS_LABELS,
  ORDER_STATUS_SHORT_LABELS,
  type OrderStatus,
} from '@/lib/constants/order-status'

/**
 * Badge de estado de pedido. Con `responsive`, en pantallas pequeñas muestra
 * la etiqueta corta (ej. "En camino") y desde `sm` la completa (ej.
 * "Repartidor en camino al negocio"): es para tarjetas donde el badge comparte
 * fila con un botón y el texto largo desborda en 375 px. Sin la prop, el
 * comportamiento es el de siempre (listas de cliente/admin/restaurante).
 *
 * Solo uno de los dos `span` es visible a la vez (`hidden` = `display: none`),
 * así que los lectores de pantalla anuncian una sola etiqueta.
 */
export function OrderStatusBadge({
  status,
  responsive = false,
}: {
  status: OrderStatus
  responsive?: boolean
}) {
  const label = ORDER_STATUS_LABELS[status] ?? status
  const shortLabel = ORDER_STATUS_SHORT_LABELS[status] ?? label

  const content = responsive ? (
    <>
      <span className="sm:hidden">{shortLabel}</span>
      <span className="hidden sm:inline">{label}</span>
    </>
  ) : (
    label
  )

  if (status === 'CANCELLED') {
    return <Badge variant="destructive">{content}</Badge>
  }
  if (status === 'DELIVERED') {
    return <Badge variant="secondary">{content}</Badge>
  }
  if (status === 'PENDING') {
    return <Badge variant="outline">{content}</Badge>
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
        {content}
      </Badge>
    )
  }
  return <Badge>{content}</Badge>
}
