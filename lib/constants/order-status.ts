export const ORDER_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Buscando repartidor',
  ASSIGNED: 'Repartidor en camino al negocio',
  PICKED_UP: 'Pedido recogido',
  ON_THE_WAY: 'En camino a tu dirección',
  DELIVERED: 'Entregado',
  CANCELLED: 'Cancelado',
}

export const ORDER_STATUS_STEPS = [
  'PENDING',
  'ASSIGNED',
  'PICKED_UP',
  'ON_THE_WAY',
  'DELIVERED',
] as const

export type OrderStatus = (typeof ORDER_STATUS_STEPS)[number] | 'CANCELLED'

export const ORDER_STATUS_GROUPS = {
  active: ['PENDING', 'ASSIGNED', 'PICKED_UP', 'ON_THE_WAY'],
  delivered: ['DELIVERED'],
  cancelled: ['CANCELLED'],
} as const

export type OrderStatusFilter = keyof typeof ORDER_STATUS_GROUPS