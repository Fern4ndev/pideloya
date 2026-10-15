// La etiqueta nombra la ACCIÓN PENDIENTE del pedido, no a quién le toca
// hacerla (por eso sirve igual en las listas del cliente, del repartidor y del
// admin). Desde el plan "pagar al recibir" (Fase 5), AWAITING_PAYMENT ya no es
// "confirma el pago" sino "elige cómo pagar": el cliente tiene dos caminos
// —pagar ahora por Yape con comprobante, o pagar al recibir— y el segundo no
// tiene nada que confirmar. Desde la verificación del Yape por el repartidor,
// AWAITING_PAYMENT cubre además la espera intermedia: el cliente ya pagó y el
// pedido está frenado hasta que el repartidor verifique el comprobante.
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

/**
 * Etiquetas CORTAS para pantallas pequeñas (ej. la tarjeta de "Mi entrega" en
 * el celular): el badge y el botón de avanzar no caben con el texto completo
 * en 375 px. Solo las usa quien lo pide explícito (`responsive` en
 * OrderStatusBadge, siempre en AdvanceStatusButton); el resto de la app sigue
 * con las completas.
 */
export const ORDER_STATUS_SHORT_LABELS: Record<string, string> = {
  PENDING: 'Buscando',
  AWAITING_PAYMENT: 'Por pagar',
  ASSIGNED: 'En camino',
  PICKED_UP: 'Recogido',
  ON_THE_WAY: 'En ruta',
  DELIVERED: 'Entregado',
  CANCELLED: 'Cancelado',
}

export type OrderStatus = (typeof ORDER_STATUS_STEPS)[number] | 'CANCELLED'

export const ORDER_STATUS_GROUPS = {
  active: ['PENDING', 'AWAITING_PAYMENT', 'ASSIGNED', 'PICKED_UP', 'ON_THE_WAY'],
  delivered: ['DELIVERED'],
  cancelled: ['CANCELLED'],
} as const

export type OrderStatusFilter = keyof typeof ORDER_STATUS_GROUPS