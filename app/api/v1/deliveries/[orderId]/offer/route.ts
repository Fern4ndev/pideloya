import {
  successResponse,
  errorResponse,
  rpcErrorResponse,
  withApi,
} from '@/lib/api/response'
import { authenticateRequest, userClient } from '@/lib/api/auth'
import { deliveryOfferSchema } from '@/lib/validations/delivery-offer'

export const dynamic = 'force-dynamic'

interface RouteCtx {
  params: Promise<{ orderId: string }>
}

/**
 * POST /api/v1/deliveries/[orderId]/offer  { delivery_fee: number }
 *
 * El repartidor propone una tarifa de envío para un pedido PENDING. Todo el
 * negocio (una sola oferta/entrega activa, rol y cuenta activa, atomicidad
 * entre `deliveries` y `orders`) vive en la función SQL offer_delivery(), la
 * MISMA que usa la Server Action del panel del repartidor — por eso acá no se
 * usa adminClient(): la función resuelve la identidad con auth.uid() y
 * rechazaría un cliente sin usuario.
 */
export const POST = withApi(async (request: Request, ctx: RouteCtx) => {
  const { orderId } = await ctx.params
  const context = await authenticateRequest(request)

  if (context.role !== 'DELIVERY') {
    return errorResponse('Solo repartidores pueden ofertar un envío', 403)
  }

  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object' || !('delivery_fee' in body)) {
    return errorResponse('delivery_fee es obligatorio', 400)
  }

  const parsed = deliveryOfferSchema.safeParse({
    deliveryFee: (body as { delivery_fee: unknown }).delivery_fee,
  })
  if (!parsed.success) {
    return errorResponse(
      parsed.error.issues[0]?.message ?? 'Tarifa de envío inválida',
      400
    )
  }

  const { error } = await userClient(request).rpc('offer_delivery', {
    p_order_id: orderId,
    p_delivery_fee: parsed.data.deliveryFee,
  })
  if (error) return rpcErrorResponse(error)

  return successResponse({ status: 'AWAITING_PAYMENT' })
})
