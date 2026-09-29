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
    // con la guarda del cobro en efectivo (D6: no se puede marcar entregado un
    // pedido CASH sin declarar que se cobró). El camino del ADMIN sigue más
    // abajo sin exigirla: es un override de soporte explícito.
    if (order.status === 'ON_THE_WAY') {
      const body = await request.json().catch(() => ({}))
      const { error } = await userClient(request).rpc('complete_delivery', {
        p_order_id: orderId,
        p_cash_collected: body?.cash_collected === true,
      })
      if (error) return rpcErrorResponse(error)
      return successResponse({ status: 'DELIVERED' })
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