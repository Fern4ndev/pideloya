import {
  successResponse,
  errorResponse,
  rpcErrorResponse,
  withApi,
} from '@/lib/api/response'
import { authenticateRequest, adminClient, userClient, NotFoundError } from '@/lib/api/auth'
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
    const hasItem = (data.order_items ?? []).some((i) =>
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

// PENDING ya no está en el mapa: el salto a ASSIGNED solo lo produce la
// confirmación del pago del envío (confirm_delivery_payment). Que el admin
// lo "avanzara" a mano creaba un ASSIGNED sin repartidor y sin tarifa — el
// cliente veía "repartidor en camino" y nadie iba por el pedido (Hallazgo 1
// de la Fase 8). Si algún día se quiere un override de soporte, tiene que
// crear la fila de deliveries, no saltarse el flujo.
const NEXT_STATUS: Record<string, { next: OrderStatus }> = {
  ASSIGNED: { next: 'PICKED_UP' },
  PICKED_UP: { next: 'ON_THE_WAY' },
  ON_THE_WAY: { next: 'DELIVERED' },
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

    // adminClient salta RLS, así que el dueño del pedido hay que verificarlo
    // EXPLÍCITAMENTE cuando quien llama es el cliente: sin este filtro, un
    // cliente autenticado podía cancelar cualquier pedido PENDING ajeno con
    // solo conocer su id (el rol ADMIN sí puede cancelar cualquiera).
    let query = client
      .from('orders')
      .update({ status: 'CANCELLED' })
      .eq('id', id)
      // Mismo criterio que la policy orders_update_own_customer_cancel: el
      // cliente puede cancelar mientras el pago del envío no esté confirmado.
      .in('status', ['PENDING', 'AWAITING_PAYMENT'])
    if (context.role === 'CUSTOMER') query = query.eq('customer_id', context.profileId)

    const { data, error } = await query.select('id').maybeSingle()

    if (error) throw error
    if (!data) {
      return errorResponse(
        'No se pudo cancelar. El pedido puede estar en camino o no ser tuyo.',
        400
      )
    }

    // Misma limpieza que la Server Action cancelOrder(): si el pedido estaba
    // en AWAITING_PAYMENT, la oferta del repartidor queda huérfana. La guarda
    // de `payment_confirmed_at` asegura que nunca se borre una entrega con
    // dinero ya confirmado.
    await client
      .from('deliveries')
      .delete()
      .eq('order_id', id)
      .is('payment_confirmed_at', null)

    return successResponse({ message: 'Pedido cancelado' })
  }

  if (action === 'confirm_payment') {
    if (context.role !== 'CUSTOMER') {
      return errorResponse('Solo el cliente puede confirmar el pago del envío', 403)
    }

    // userClient() y no adminClient(): confirm_delivery_payment() valida que el
    // pedido sea del usuario que llama usando auth.uid(), que no existe en un
    // cliente con service role. Con adminClient esto fallaría con 'No
    // autenticado' — comportamiento buscado, no un bug de la ruta.
    const { error } = await userClient(request).rpc('confirm_delivery_payment', {
      p_order_id: id,
    })
    if (error) return rpcErrorResponse(error)

    return successResponse({ status: 'ASSIGNED' })
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
      return errorResponse(
        order.status === 'PENDING' || order.status === 'AWAITING_PAYMENT'
          ? 'Este pedido necesita una oferta de envío y la confirmación de pago del cliente antes de avanzar.'
          : 'Este pedido no puede avanzar de estado',
        400
      )
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
    "Acción inválida. Usa { action: 'cancel' | 'advance' | 'confirm_payment' }",
    400
  )
})