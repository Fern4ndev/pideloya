import {
  successResponse,
  errorResponse,
  rpcErrorResponse,
  withApi,
} from '@/lib/api/response'
import { authenticateRequest, adminClient, userClient, NotFoundError } from '@/lib/api/auth'
import { paymentVoucherPath } from '@/lib/constants/payment-voucher'
import {
  paymentMethodSchema,
  paymentSelectionSchema,
} from '@/lib/validations/payment-method'
import { removeUnconfirmedVoucher } from '@/lib/storage/payment-vouchers'
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

    // CLIENTE: la RPC SECURITY DEFINER cancel_order(uuid) (migración
    // 20261003120100) valida por dentro que el pedido sea suyo (42501 si no)
    // y que siga cancelable — PENDING o AWAITING_PAYMENT, el criterio de la
    // antigua policy orders_update_own_customer_cancel — y borra la oferta sin
    // confirmar en la MISMA transacción. userClient() y no adminClient(): la
    // función resuelve identidad con auth.uid(), que no existe en service
    // role (comportamiento buscado, no un bug).
    if (context.role === 'CUSTOMER') {
      const { error } = await userClient(request).rpc('cancel_order', {
        p_order_id: id,
      })
      if (error) return rpcErrorResponse(error)

      // Comprobante huérfano, best-effort DESPUÉS de la RPC: la fila de
      // `deliveries` ya no existe (la RPC la borró con su guarda
      // payment_confirmed_at is null), así que removeUnconfirmedVoucher borra
      // el archivo sin riesgo de tocar un pago confirmado.
      await removeUnconfirmedVoucher(client, id)

      return successResponse({ message: 'Pedido cancelado' })
    }

    // ADMIN: override de soporte por service role (cancela cualquier estado;
    // el cliente ya no pasa por acá). La limpieza de la oferta es manual y el
    // filtro `payment_confirmed_at is null` es la misma guarda dura que nunca
    // toca una entrega con dinero ya confirmado.
    const { data, error } = await client
      .from('orders')
      .update({ status: 'CANCELLED' })
      .eq('id', id)
      .select('id')
      .maybeSingle()

    if (error) throw error
    if (!data) {
      return errorResponse('No se pudo cancelar el pedido', 400)
    }

    await removeUnconfirmedVoucher(client, id)
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

    // Compatibilidad con las integraciones desplegadas: el método dejó de
    // formar parte de la elección, pero se sigue ACEPTANDO en el cuerpo.
    //   { timing: 'UPFRONT' } | { timing: 'ON_DELIVERY' }  ← forma nueva
    //   { method: 'CASH' }   ⇒ ON_DELIVERY
    //   { method: 'YAPE' } | sin cuerpo ⇒ UPFRONT
    // La DERIVACIÓN vive en la función SQL (un `timing` explícito manda; sin
    // él, 'CASH' significa "al recibir" y todo lo demás "ahora"), así que acá
    // solo se reenvía el método si llegó.
    //
    // Con UPFRONT el ORDEN ES OBLIGATORIO: primero subir el comprobante a
    // `payment-vouchers/{order_id}/voucher.jpg` con el MISMO token Bearer (la
    // RLS que lo autoriza es la del usuario; no hay camino privilegiado que
    // saltarse), y recién después llamar esta acción. Si no lo hizo, la función
    // responde 400 "Adjunta el comprobante de tu pago para confirmar": el fallo
    // es explícito, nunca una confirmación sin evidencia.
    //
    // Con ON_DELIVERY no se sube nada (D5): en la puerta existe la app de Yape
    // del repartidor o el billete, no una captura previa. La función responde
    // 400 si le llega cualquier ruta, y 400 "Este repartidor solo acepta pago
    // por adelantado" si el repartidor no acepta cobrar al recibir (D7).
    //
    // La ruta se deriva del id ACÁ y la función la vuelve a validar contra su
    // formato único: el consumidor no elige dónde vive su comprobante.
    //
    // userClient() y no adminClient(): select_delivery_payment() valida que el
    // pedido sea del usuario que llama usando auth.uid(), que no existe en un
    // cliente con service role. Con adminClient esto fallaría con 'No
    // autenticado' — comportamiento buscado, no un bug de la ruta.
    const rawMethod = body.method
    const requestedTiming = body.timing
    // El medio dejó de ser parte de la elección, pero un `method` que llegue en
    // el cuerpo se sigue VALIDANDO: derivar "sin método conocido ⇒ Yape" de
    // cualquier cadena convertiría un error del cliente en una confirmación por
    // adelantado. Solo entran los dos valores legacy; el resto responde 400 con
    // el mismo mensaje mostrable de siempre.
    if (rawMethod != null) {
      const legacy = paymentMethodSchema.safeParse(rawMethod)
      if (!legacy.success) {
        return errorResponse(
          legacy.error.issues[0]?.message ?? 'Elección de pago inválida',
          400
        )
      }
    }
    const parsed = paymentSelectionSchema.safeParse({
      timing:
        requestedTiming ?? (rawMethod === 'CASH' ? 'ON_DELIVERY' : 'UPFRONT'),
    })
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0]?.message ?? 'Elección de pago inválida', 400)
    }
    const timing = parsed.data.timing

    const { error } = await userClient(request).rpc('select_delivery_payment', {
      p_order_id: id,
      p_timing: timing,
      // Con pago por adelantado el único método posible es Yape (lo exige el
      // CHECK deliveries_timing_method_check); con ON_DELIVERY se omite y la
      // función lo guarda NULL, aunque el cuerpo haya traído un método legacy.
      p_method: timing === 'UPFRONT' ? 'YAPE' : undefined,
      // La ruta viaja SOLO con pago por adelantado: con `undefined` la clave no
      // se envía y la función aplica su DEFAULT null, que es lo que exige el
      // CHECK deliveries_voucher_requires_upfront_check.
      p_voucher_path: timing === 'UPFRONT' ? paymentVoucherPath(id) : undefined,
    })
    if (error) return rpcErrorResponse(error)

    // La respuesta reporta lo GUARDADO (no lo pedido): con ON_DELIVERY el
    // método es null aunque el cuerpo haya mandado uno legacy.
    return successResponse({
      status: 'ASSIGNED',
      payment_method: timing === 'UPFRONT' ? 'YAPE' : null,
      payment_timing: timing,
    })
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

      // Último paso por el camino del repartidor: lo hace complete_delivery(),
      // atómica y con la constancia del cobro en `collected_at` (D8: "no pude
      // cobrar" no es este camino, es una incidencia). Un `collected` o
      // `collected_method` que llegue en el cuerpo se IGNORA: el medio del cobro
      // ya no se pregunta (migración 20261003100000). El camino del ADMIN sigue
      // más abajo sin pasar por acá: es un override de soporte explícito.
      if (order.status === 'ON_THE_WAY') {
        const { error } = await userClient(request).rpc('complete_delivery', {
          p_order_id: id,
        })
        if (error) return rpcErrorResponse(error)
        return successResponse({ status: 'DELIVERED' })
      }

      // Primer paso por el camino del repartidor: pickup_delivery() (migración
      // 20261002100300), que además de PICKED_UP escribe la constancia D6
      // `orders.restaurant_paid_at` cuando el cuerpo lo pide. Body:
      // { restaurant_paid?: boolean }.
      if (order.status === 'ASSIGNED') {
        const { error } = await userClient(request).rpc('pickup_delivery', {
          p_order_id: id,
          p_restaurant_paid: body.restaurant_paid === true,
        })
        if (error) return rpcErrorResponse(error)
        return successResponse({ status: 'PICKED_UP' })
      }

      // Paso intermedio PICKED_UP → ON_THE_WAY: start_route() (migración
      // 20261003120100), que valida por dentro que el pedido esté asignado a
      // quien llama (42501) y que esté PICKED_UP (22000). Antes era un UPDATE
      // directo; la migración contract revoca UPDATE en orders para
      // `authenticated` y esta es la puerta de reemplazo. El camino del ADMIN
      // sigue más abajo sin pasar por acá: es un override de soporte explícito.
      if (order.status === 'PICKED_UP') {
        const { error } = await userClient(request).rpc('start_route', {
          p_order_id: id,
        })
        if (error) return rpcErrorResponse(error)
        return successResponse({ status: 'ON_THE_WAY' })
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