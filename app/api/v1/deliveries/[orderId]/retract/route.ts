import { successResponse, errorResponse, rpcErrorResponse, withApi } from '@/lib/api/response'
import { authenticateRequest, userClient } from '@/lib/api/auth'

export const dynamic = 'force-dynamic'

interface RouteCtx {
  params: Promise<{ orderId: string }>
}

/**
 * POST /api/v1/deliveries/[orderId]/retract
 *
 * El repartidor retira su oferta de envío mientras el cliente no haya
 * confirmado el pago: el pedido vuelve a PENDING y queda disponible otra vez.
 * Delega en retract_delivery_offer() (atómica y con la autorización adentro),
 * la misma función que usa la Server Action.
 */
export const POST = withApi(async (request: Request, ctx: RouteCtx) => {
  const { orderId } = await ctx.params
  const context = await authenticateRequest(request)

  if (context.role !== 'DELIVERY') {
    return errorResponse('Solo repartidores pueden retirar su oferta', 403)
  }

  const { error } = await userClient(request).rpc('retract_delivery_offer', {
    p_order_id: orderId,
  })
  if (error) return rpcErrorResponse(error)

  return successResponse({ status: 'PENDING' })
})
