import { successResponse, errorResponse, withApi } from '@/lib/api/response'
import { authenticateRequest, adminClient, NotFoundError } from '@/lib/api/auth'
import type { OrderStatus } from '@/types/order'

export const dynamic = 'force-dynamic'

interface RouteCtx {
  params: Promise<{ orderId: string }>
}

const NEXT_STATUS: Record<
  OrderStatus,
  { next: OrderStatus; stamp?: 'picked_up_at' | 'delivered_at' }
> = {
  ASSIGNED: { next: 'PICKED_UP', stamp: 'picked_up_at' },
  PICKED_UP: { next: 'ON_THE_WAY' },
  ON_THE_WAY: { next: 'DELIVERED', stamp: 'delivered_at' },
  PENDING: { next: 'ASSIGNED' },
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