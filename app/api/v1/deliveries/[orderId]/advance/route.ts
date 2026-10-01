import { successResponse, errorResponse, rpcErrorResponse, withApi } from '@/lib/api/response'
import { authenticateRequest, adminClient, userClient, NotFoundError } from '@/lib/api/auth'
import type { OrderStatus } from '@/types/order'

export const dynamic = 'force-dynamic'

interface RouteCtx {
  params: Promise<{ orderId: string }>
}

const NEXT_STATUS: Partial<
  Record<OrderStatus, { next: OrderStatus; stamp?: 'picked_up_at' | 'delivered_at' }>
> = {
  ASSIGNED: { next: 'PICKED_UP', stamp: 'picked_up_at' },
  PICKED_UP: { next: 'ON_THE_WAY' },
  // El `stamp` de ON_THE_WAY solo lo usa el override del ADMIN: el camino del
  // repartidor delega en complete_delivery() (que marca la entrega Y registra
  // el cobro en efectivo en una sola transacción) y retorna antes de llegar al
  // UPDATE de abajo.
  ON_THE_WAY: { next: 'DELIVERED', stamp: 'delivered_at' },
  // Ni PENDING ni AWAITING_PAYMENT se avanzan desde acá: el salto a ASSIGNED
  // solo lo produce la elección del método de pago (RPC
  // select_delivery_payment). AWAITING_PAYMENT queda en self-map para que la
  // guarda responda 400 "no puede avanzar"; PENDING salió del mapa porque un
  // PENDING no tiene repartidor — era el bypass por el que el admin podía
  // crear un ASSIGNED sin entrega ni tarifa (Hallazgo 1 de la Fase 8).
  AWAITING_PAYMENT: { next: 'AWAITING_PAYMENT' },
  DELIVERED: { next: 'DELIVERED' },
  CANCELLED: { next: 'CANCELLED' },
}

export const PUT = withApi(async (request: Request, ctx: RouteCtx) => {
  const { orderId } = await ctx.params
  const context = await authenticateRequest(request)

  if (context.role !== 'DELIVERY' && context.role !== 'ADMIN') {
    return errorResponse('Solo repartidores pueden avanzar el estado', 403)
  }

  const client = adminClient()

  const { data: order } = await client
    .from('orders')
    .select('status')
    .eq('id', orderId)
    .maybeSingle()
  if (!order) throw new NotFoundError('Pedido no encontrado')

  const transition = NEXT_STATUS[order.status]
  if (!transition || transition.next === order.status) {
    return errorResponse('Este pedido no puede avanzar de estado', 400)
  }

  if (context.role === 'DELIVERY') {
    const { data: delivery } = await client
      .from('deliveries')
      .select('id')
      .eq('order_id', orderId)
      .eq('delivery_person_id', context.profileId)
      .maybeSingle()
    if (!delivery) {
      return errorResponse('No tienes este pedido asignado', 403)
    }

    // Último paso por el camino del repartidor: complete_delivery(), atómica y
    // con la guarda del cobro declarado (D4/D8: un pedido que se paga al
    // recibir no se cierra sin declarar el medio real del cobro; body
    // { collected?: boolean, collected_method?: 'YAPE'|'CASH' }). El alias
    // cash_collected del ciclo anterior se retiró con la Fase 12. El camino del
    // ADMIN sigue más abajo sin exigirla: es un override de soporte explícito.
    if (order.status === 'ON_THE_WAY') {
      const body = await request.json().catch(() => ({}))
      const collectedMethod =
        body?.collected_method === 'YAPE' || body?.collected_method === 'CASH'
          ? body.collected_method
          : undefined
      const collected = body?.collected === true
      const { error } = await userClient(request).rpc('complete_delivery', {
        p_order_id: orderId,
        p_collected_method: collected ? (collectedMethod ?? 'CASH') : null,
      })
      if (error) return rpcErrorResponse(error)
      return successResponse({ status: 'DELIVERED' })
    }

    // Primer paso: pickup_delivery() (migración 20261002100300), que además de
    // PICKED_UP escribe la constancia D6 `orders.restaurant_paid_at` cuando el
    // cuerpo lo pide. Body: { restaurant_paid?: boolean }.
    if (order.status === 'ASSIGNED') {
      const body = await request.json().catch(() => ({}))
      const { error } = await userClient(request).rpc('pickup_delivery', {
        p_order_id: orderId,
        p_restaurant_paid: body?.restaurant_paid === true,
      })
      if (error) return rpcErrorResponse(error)
      return successResponse({ status: 'PICKED_UP' })
    }
  }

  const { error } = await client
    .from('orders')
    .update({ status: transition.next })
    .eq('id', orderId)
  if (error) throw error

  if (transition.stamp === 'picked_up_at') {
    await client
      .from('deliveries')
      .update({ picked_up_at: new Date().toISOString() })
      .eq('order_id', orderId)
  } else if (transition.stamp === 'delivered_at') {
    await client
      .from('deliveries')
      .update({ delivered_at: new Date().toISOString() })
      .eq('order_id', orderId)
  }

  return successResponse({ status: transition.next })
})