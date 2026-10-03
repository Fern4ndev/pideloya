import { successResponse, errorResponse, withApi } from '@/lib/api/response'
import { authenticateRequest, adminClient, NotFoundError } from '@/lib/api/auth'
import { ACTIVE_DELIVERY_STATUSES } from '@/lib/admin/delivery-lifecycle'

export const dynamic = 'force-dynamic'

interface RouteCtx {
  params: Promise<{ orderId: string }>
}

export const POST = withApi(async (request: Request, ctx: RouteCtx) => {
  const { orderId } = await ctx.params
  const context = await authenticateRequest(request)

  // Solo DELIVERY. El ADMIN aceptar "como él mismo" creaba una entrega sin
  // repartidor real (su propio profile no es un repartidor) y saltaba el pago
  // del envío — el mismo bypass que el advance PENDING → ASSIGNED (Hallazgo 1
  // de la Fase 8). Si el flujo de aceptación directa vuelve algún día, vuelve
  // cerrado a DELIVERY y pasando por el pago.
  if (context.role !== 'DELIVERY') {
    return errorResponse('Solo repartidores pueden aceptar pedidos', 403)
  }

  const client = adminClient()

  // Regla de negocio: un repartidor solo puede tener UNA entrega activa.
  // adminClient salta RLS, así que el filtro por persona debe ser EXPLÍCITO:
  // solo cuentan las entregas activas MÍAS (deliveries.delivery_person_id),
  // no las de otros repartidores.
  if (context.role === 'DELIVERY') {
    const { data: active } = await client
      .from('deliveries')
      .select('id, orders!inner(status)')
      .eq('delivery_person_id', context.profileId)
      .in('orders.status', [...ACTIVE_DELIVERY_STATUSES])
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