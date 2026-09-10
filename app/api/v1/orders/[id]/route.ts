import { successResponse, errorResponse, withApi } from '@/lib/api/response'
import { authenticateRequest, adminClient, NotFoundError } from '@/lib/api/auth'
import type { OrderStatus } from '@/types/order'

export const dynamic = 'force-dynamic'

interface RouteCtx {
  params: Promise<{ id: string }>
}

async function getOrderForContext(
  context: Awaited<ReturnType<typeof authenticateRequest>>,
  orderId: string
) {
  const client = adminClient()

  if (context.role === 'ADMIN') {
    const { data, error } = await client
      .from('orders')
      .select('*, order_items(*), addresses(*)')
      .eq('id', orderId)
      .maybeSingle()
    if (error) throw error
    if (!data) throw new NotFoundError('Pedido no encontrado')
    return data
  }

  if (context.role === 'CUSTOMER') {
    const { data, error } = await client
      .from('orders')
      .select('*, order_items(*), addresses(*)')
      .eq('id', orderId)
      .eq('customer_id', context.profileId)
      .maybeSingle()
    if (error) throw error
    if (!data) throw new NotFoundError('Pedido no encontrado')
    return data
  }

  if (context.role === 'DELIVERY') {
    const { data, error } = await client
      .from('orders')
      .select('*, order_items(*), addresses(*), deliveries(*)')
      .eq('id', orderId)
      .maybeSingle()
    if (error) throw error
    if (!data) throw new NotFoundError('Pedido no encontrado')

    const isAssigned = data.deliveries?.delivery_person_id === context.profileId
    if (data.status !== 'PENDING' && !isAssigned) {
      throw new NotFoundError('Pedido no encontrado')
    }
    return data
  }

  if (context.role === 'RESTAURANT') {
    const { data, error } = await client
      .from('orders')
      .select('*, order_items(*), addresses(*)')
      .eq('id', orderId)
      .maybeSingle()
    if (error) throw error
    if (!data) throw new NotFoundError('Pedido no encontrado')

    const { data: members } = await client
      .from('restaurant_members')
      .select('restaurant_id')
      .eq('user_id', context.profileId)
    const restaurantIds = (members ?? []).map((m) => m.restaurant_id)
    const hasItem = (data.order_items ?? []).some((i: any) =>
      restaurantIds.includes(i.restaurant_id)
    )
    if (!hasItem) throw new NotFoundError('Pedido no encontrado')
    return data
  }

  throw new NotFoundError('Pedido no encontrado')
}

export const GET = withApi(async (_request: Request, ctx: RouteCtx) => {
  const { id } = await ctx.params
  const context = await authenticateRequest(_request)
  const order = await getOrderForContext(context, id)
  return successResponse(order)
})

const NEXT_STATUS: Record<string, { next: OrderStatus }> = {
  ASSIGNED: { next: 'PICKED_UP' },
  PICKED_UP: { next: 'ON_THE_WAY' },
  ON_THE_WAY: { next: 'DELIVERED' },
  PENDING: { next: 'ASSIGNED' },
  DELIVERED: { next: 'DELIVERED' },
  CANCELLED: { next: 'CANCELLED' },
}

export const PUT = withApi(async (request: Request, ctx: RouteCtx) => {
  const { id } = await ctx.params
  const context = await authenticateRequest(request)
  const body = await request.json().catch(() => null)
  if (!body) return errorResponse('Cuerpo inválido', 400)

  const client = adminClient()
  const action = body.action as string | undefined

  if (action === 'cancel') {
    if (context.role !== 'CUSTOMER' && context.role !== 'ADMIN') {
      return errorResponse('No tienes permiso para cancelar pedidos', 403)
    }

    const { data, error } = await client
      .from('orders')
      .update({ status: 'CANCELLED' })
      .eq('id', id)
      .eq('status', 'PENDING')
      .select('id')
      .maybeSingle()

    if (error) throw error
    if (!data) {
      return errorResponse(
        'No se pudo cancelar. El pedido puede estar en camino o no ser tuyo.',
        400
      )
    }
    return successResponse({ message: 'Pedido cancelado' })
  }

  if (action === 'advance') {
    if (context.role !== 'DELIVERY' && context.role !== 'ADMIN') {
      return errorResponse('Solo repartidores pueden avanzar el estado', 403)
    }

    const { data: order } = await client
      .from('orders')
      .select('status')
      .eq('id', id)
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
        .eq('order_id', id)
        .eq('delivery_person_id', context.profileId)
        .maybeSingle()
      if (!delivery) {
        return errorResponse('No tienes este pedido asignado', 403)
      }
    }

    const { error } = await client
      .from('orders')
      .update({ status: transition.next })
      .eq('id', id)
    if (error) throw error

    const stamp = new Date().toISOString()
    if (order.status === 'ASSIGNED') {
      await client
        .from('deliveries')
        .update({ picked_up_at: stamp })
        .eq('order_id', id)
    } else if (order.status === 'ON_THE_WAY') {
      await client
        .from('deliveries')
        .update({ delivered_at: stamp })
        .eq('order_id', id)
    }

    return successResponse({ status: transition.next })
  }

  return errorResponse(
    "Acción inválida. Usa { action: 'cancel' | 'advance' }",
    400
  )
})