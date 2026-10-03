import { withApi, successResponse, errorResponse, rpcErrorResponse } from '@/lib/api/response'
import { authenticateRequest, adminClient, userClient } from '@/lib/api/auth'
import { isRestaurantOpenNow } from '@/lib/restaurants/is-open'
import {
  ORDER_STATUS_GROUPS,
  type OrderStatusFilter,
} from '@/lib/constants/order-status'

export const dynamic = 'force-dynamic'

/**
 * Trae un pedido con sus items y la dirección de entrega.
 * Se usa por GET collection e individual.
 */
export const GET = withApi(async (request: Request) => {
  const context = await authenticateRequest(request)
  const client = adminClient()

  // ADMIN: ve todos los pedidos.
  if (context.role === 'ADMIN') {
    const { data, error } = await client
      .from('orders')
      .select('*, order_items(*), addresses(*)')
      .order('created_at', { ascending: false })
      .limit(100)
    if (error) throw error
    return successResponse(data)
  }

  // RESTAURANT: pedidos que contienen sus productos.
  if (context.role === 'RESTAURANT') {
    const { data: members } = await client
      .from('restaurant_members')
      .select('restaurant_id')
      .eq('user_id', context.profileId)
    const restaurantIds = (members ?? []).map((m) => m.restaurant_id)
    if (restaurantIds.length === 0) return successResponse([])

    const { data: items } = await client
      .from('order_items')
      .select('order_id')
      .in('restaurant_id', restaurantIds)

    const orderIds = [...new Set((items ?? []).map((i) => i.order_id))]
    if (orderIds.length === 0) return successResponse([])

    const { data, error } = await client
      .from('orders')
      .select('*, order_items(*), addresses(*)')
      .in('id', orderIds)
      .order('created_at', { ascending: false })
    if (error) throw error
    return successResponse(data)
  }

  // CUSTOMER: solo sus propios pedidos, paginados para el scroll infinito de
  // /cliente/pedidos. `meta.counts` son conteos globales (sin paginar) que
  // alimentan los chips y banners: con páginas parciales ya no se pueden
  // calcular en el cliente a partir del array.
  if (context.role === 'CUSTOMER') {
    const url = new URL(request.url)
    const offsetRaw = Number(url.searchParams.get('offset'))
    const limitRaw = Number(url.searchParams.get('limit'))
    const offset = Number.isFinite(offsetRaw) && offsetRaw > 0 ? Math.floor(offsetRaw) : 0
    const limit =
      Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(Math.floor(limitRaw), 50) : 15

    // `status` invalido se ignora (devuelve todo) en vez de fallar: el front
    // solo manda valores validados contra ORDER_STATUS_GROUPS.
    const statusRaw = url.searchParams.get('status')
    const statusGroup =
      statusRaw && statusRaw in ORDER_STATUS_GROUPS
        ? ORDER_STATUS_GROUPS[statusRaw as OrderStatusFilter]
        : null

    let query = client
      .from('orders')
      .select('*, order_items(*), addresses(*)')
      .eq('customer_id', context.profileId)
    if (statusGroup) query = query.in('status', [...statusGroup])

    // Los 5 conteos que alimentan chips/banners van en UNA consulta:
    // my_order_counts() (migración 20261003120600, SECURITY INVOKER — la RLS
    // sigue aplicando). Antes eran 5 consultas count 'exact' en Promise.all
    // POR CADA página del scroll infinito. userClient() y no adminClient():
    // la función resuelve identidad con auth.uid() via current_profile_id().
    const [page, countsResult] = await Promise.all([
      query
        .order('created_at', { ascending: false })
        .order('id', { ascending: false }) // desempate para offsets estables
        .range(offset, offset + limit - 1),
      userClient(request).rpc('my_order_counts'),
    ])
    if (page.error) throw page.error
    if (countsResult.error) throw countsResult.error

    const countsRow = countsResult.data?.[0]
    return successResponse(page.data, 200, {
      counts: {
        all: Number(countsRow?.all_orders ?? 0),
        active: Number(countsRow?.active ?? 0),
        delivered: Number(countsRow?.delivered ?? 0),
        cancelled: Number(countsRow?.cancelled ?? 0),
        pending: Number(countsRow?.pending ?? 0),
      },
      limit,
      offset,
    })
  }

  // DELIVERY: asignados a él o disponibles (PENDING).
  // userClient() y no adminClient() (Hallazgo H3): la RLS hace el filtro que
  // antes se repetía en JavaScript — orders_select_delivery limita a PENDING
  // (disponibles para cualquier repartidor) + pedidos con entrega asignada a
  // MÍ. El filtro en JS era redundante y obligaba a leer con service role
  // (menor privilegio violado). Consecuencia esperada: `addresses` solo se
  // expande para pedidos ASIGNADOS (addresses_select_assigned_delivery); para
  // PENDING llega null, que es lo correcto — la dirección del cliente no se
  // revela antes de que nadie acepte el pedido.
  // AWAITING_PAYMENT va en la lista para que el repartidor vea su oferta
  // esperando el pago en "Mis entregas" (y pueda retirarla).
  if (context.role === 'DELIVERY') {
    const { data, error } = await userClient(request)
      .from('orders')
      .select(
        // latitude/longitude del restaurante ya NO viajan: el repartidor fija
        // su propio precio sin ayuda de ningún cálculo de distancia (Fase 1 de
        // plan-tarifa-libre-repartidor-y-pulido-panel-cliente.md).
        '*, order_items(*, restaurants(name, address_text)), addresses(*), deliveries(*)'
      )
      .in('status', [
        'PENDING',
        'AWAITING_PAYMENT',
        'ASSIGNED',
        'PICKED_UP',
        'ON_THE_WAY',
      ])
      .order('created_at', { ascending: false })
    if (error) throw error
    return successResponse(data ?? [])
  }

  return errorResponse('Acción no permitida', 403)
})

export const POST = withApi(async (request: Request) => {
  const context = await authenticateRequest(request)
  if (context.role !== 'CUSTOMER') {
    return errorResponse('Solo clientes pueden crear pedidos', 403)
  }

  const body = await request.json().catch(() => null)
  if (!body) return errorResponse('Cuerpo inválido', 400)

  const { address_id: addressId, notes, items, client_request_id: clientRequestId } = body as {
    address_id?: string
    notes?: string
    items?: { product_id: string; quantity: number }[]
    // Opcional: los consumidores de la API pueden mandarlo para que un
    // reintento de red no cree dos pedidos (idempotencia, migración
    // 20261003120700). La Server Action del navegador SIEMPRE lo manda.
    client_request_id?: string
  }

  if (!addressId || !items || items.length === 0) {
    return errorResponse('address_id e items (no vacío) son obligatorios', 400)
  }

  if (items.some((i) => !Number.isInteger(i.quantity) || i.quantity <= 0)) {
    return errorResponse('quantity debe ser un entero positivo', 400)
  }

  const client = adminClient()

  // Guard de atención (la RPC NO valida horario — decisión documentada en la
  // migración 20261003120700; portarla a SQL es Fase 5). Se deriva del
  // restaurante REAL de los productos pedidos, nunca de un campo que viaje
  // desde el cliente.
  const productIds = items.map((i) => i.product_id)
  const { data: products, error: productsError } = await client
    .from('products')
    .select('restaurant_id')
    .in('id', productIds)

  if (productsError) throw productsError
  if (!products || products.length !== productIds.length) {
    return errorResponse('Alguno de los productos ya no está disponible', 400)
  }

  const restaurantIds = new Set(products.map((p) => p.restaurant_id))
  if (restaurantIds.size > 1) {
    return errorResponse('No puedes pedir de más de un restaurante a la vez', 400)
  }

  const restaurantId = Array.from(restaurantIds)[0]
  const { data: restaurant } = await client
    .from('restaurants')
    .select('is_approved, is_active, is_open')
    .eq('id', restaurantId)
    .maybeSingle()
  if (!restaurant || !restaurant.is_active || !restaurant.is_approved) {
    return errorResponse('El negocio ya no está disponible', 409)
  }

  const { data: hours } = await client
    .from('restaurant_hours')
    .select('day_of_week, open_time, close_time, is_closed')
    .eq('restaurant_id', restaurantId)
  if (!isRestaurantOpenNow(restaurant.is_open, hours ?? [])) {
    return errorResponse(
      'El negocio está cerrado en este momento. No se pueden recibir pedidos.',
      409
    )
  }

  // create_order() (migración 20261003120700): pedido + ítems en UNA
  // transacción, total SIEMPRE recalculado en servidor, snapshot del cliente
  // congelado, dirección/productos/rol validados por dentro, tope de 3
  // pedidos activos e IDEMPOTENCIA por client_request_id (reintento con el
  // mismo id devuelve el MISMO pedido). userClient() y no adminClient(): la
  // función resuelve identidad con auth.uid() (con service role no hay
  // usuario y rechazaría con 'No autenticado' — comportamiento buscado).
  const { data: orderId, error } = await userClient(request).rpc('create_order', {
    p_address_id: addressId,
    p_notes: notes || null,
    p_items: items,
    p_client_request_id: clientRequestId ?? null,
  })
  if (error) return rpcErrorResponse(error)

  return successResponse({ orderId }, 201)
})