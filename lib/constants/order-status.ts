// La etiqueta nombra la ACCIÓN PENDIENTE del pedido, no a quién le toca
// hacerla (por eso sirve igual en las listas del cliente, del repartidor y del
// admin). Desde la Fase 5.4 del plan del método de pago, AWAITING_PAYMENT ya no
// es "confirma el pago" sino "elige cómo pagar": el cliente tiene dos caminos
// —Yape con comprobante o efectivo al recibir— y el segundo no tiene nada que
// confirmar.
export const ORDER_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Buscando repartidor',
  AWAITING_PAYMENT: 'Elige cómo pagar el envío',
  ASSIGNED: 'Repartidor en camino al negocio',
  PICKED_UP: 'Pedido recogido',
  ON_THE_WAY: 'En camino a tu dirección',
  DELIVERED: 'Entregado',
  CANCELLED: 'Cancelado',
}

export const ORDER_STATUS_STEPS = [
  'PENDING',
  'AWAITING_PAYMENT',
  'ASSIGNED',
  'PICKED_UP',
  'ON_THE_WAY',
  'DELIVERED',
] as const

export type OrderStatus = (typeof ORDER_STATUS_STEPS)[number] | 'CANCELLED'

export const ORDER_STATUS_GROUPS = {
  active: ['PENDING', 'AWAITING_PAYMENT', 'ASSIGNED', 'PICKED_UP', 'ON_THE_WAY'],
  delivered: ['DELIVERED'],
  cancelled: ['CANCELLED'],
} as const

export type OrderStatusFilter = keyof typeof ORDER_STATUS_GROUPS