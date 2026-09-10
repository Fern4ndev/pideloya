import { successResponse, errorResponse, withApi } from '@/lib/api/response'
import { authenticateRequest, adminClient, NotFoundError } from '@/lib/api/auth'

export const dynamic = 'force-dynamic'

interface RouteCtx {
  params: Promise<{ orderId: string }>
}

export const POST = withApi(async (request: Request, ctx: RouteCtx) => {
  const { orderId } = await ctx.params
  const context = await authenticateRequest(request)

  if (context.role !== 'DELIVERY' && context.role !== 'ADMIN') {
    return errorResponse('Solo repartidores pueden aceptar pedidos', 403)
  }

  const client = adminClient()

  // Regla de negocio: un repartidor solo puede tener UNA entrega activa.
  if (context.role === 'DELIVERY') {
    const { data: active } = await client
      .from('orders')
      .select('id')
      .in('status', ['ASSIGNED', 'PICKED_UP', 'ON_THE_WAY'])
      .limit(1)
    if (active && active.length > 0) {
      return errorResponse(
        'Ya tienes una entrega activa. Complétala antes de aceptar otra.',
        400
      )
    }
  }

  const { data: order } = await client
    .from('orders')
    .select('status')
    .eq('id', orderId)
    .maybeSingle()
  if (!order) throw new NotFoundError('Pedido no encontrado')
  if (order.status !== 'PENDING') {
    return errorResponse('Este pedido ya no está disponible', 400)
  }

  const { error: deliveryError } = await client.from('deliveries').insert({
    order_id: orderId,
    delivery_person_id: context.profileId,
    accepted_at: new Date().toISOString(),
  })

  if (deliveryError) {
    return errorResponse('Alguien más aceptó este pedido justo antes que tú', 409)
  }

  const { error: orderError } = await client
    .from('orders')
    .update({ status: 'ASSIGNED' })
    .eq('id', orderId)
  if (orderError) throw orderError

  return successResponse({ message: 'Pedido aceptado', status: 'ASSIGNED' })
})