import { withApi, successResponse, errorResponse } from '@/lib/api/response'
import { authenticateRequest, adminClient } from '@/lib/api/auth'
import { isRestaurantOpenNow } from '@/lib/restaurants/is-open'

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

  // CUSTOMER: solo sus propios pedidos.
  if (context.role === 'CUSTOMER') {
    const { data, error } = await client
      .from('orders')
      .select('*, order_items(*), addresses(*)')
      .eq('customer_id', context.profileId)
      .order('created_at', { ascending: false })
    if (error) throw error
    return successResponse(data)
  }

  // DELIVERY: asignados a él o disponibles (PENDING).
  // restaurants se expande para pickupAddress (dirección de recojo) —
  // adminClient salta RLS, así funciona aunque el restaurante esté
  // desactivado. El nombre de la tarjeta usa el snapshot restaurant_name.
  if (context.role === 'DELIVERY') {
    const { data, error } = await client
      .from('orders')
      .select(
        '*, order_items(*, restaurants(name, address_text)), addresses(*), deliveries(*)'
      )
      .in('status', ['PENDING', 'ASSIGNED', 'PICKED_UP', 'ON_THE_WAY'])
      .order('created_at', { ascending: false })
    if (error) throw error
    const filtered = (data ?? []).filter(
      (o: any) =>
        o.status === 'PENDING' ||
        o.deliveries?.delivery_person_id === context.profileId
    )
    return successResponse(filtered)
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

  const { address_id: addressId, notes, items } = body as {
    address_id?: string
    notes?: string
    items?: { product_id: string; quantity: number }[]
  }

  if (!addressId || !items || items.length === 0) {
    return errorResponse('address_id e items (no vacío) son obligatorios', 400)
  }

  if (items.some((i) => !Number.isInteger(i.quantity) || i.quantity <= 0)) {
    return errorResponse('quantity debe ser un entero positivo', 400)
  }

  const client = adminClient()

  // Verifica que la dirección pertenece al cliente.
  const { data: addr } = await client
    .from('addresses')
    .select('id')
    .eq('id', addressId)
    .eq('customer_id', context.profileId)
    .maybeSingle()
  if (!addr) return errorResponse('Dirección inválida', 400)

  // Trae los productos reales y recalcula el total en servidor.
  const productIds = items.map((i) => i.product_id)
  const { data: products, error: productsError } = await client
    .from('products')
    .select('id, name, price, available, restaurant_id, image_url, restaurants(name)')
    .in('id', productIds)

  if (productsError) throw productsError
  if (!products || products.length !== productIds.length) {
    return errorResponse('Alguno de los productos ya no está disponible', 400)
  }
  if (products.some((p) => !p.available)) {
    return errorResponse('Alguno de los productos ya no está disponible', 400)
  }

  const restaurantIds = new Set(products.map((p) => p.restaurant_id))
  if (restaurantIds.size > 1) {
    return errorResponse('No puedes pedir de más de un restaurante a la vez', 400)
  }

  // Guard de atención: el restaurante debe estar aprobado, activo y dentro
  // del horario (is_open + restaurant_hours). La API usa service role y
  // salta RLS, por eso la validación es explícita aquí.
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

  const total = items.reduce((sum, item) => {
    const product = products.find((p) => p.id === item.product_id)!
    return sum + Number(product.price) * item.quantity
  }, 0)

  const { data: order, error: orderError } = await client
    .from('orders')
    .insert({
      customer_id: context.profileId,
      address_id: addressId,
      status: 'PENDING',
      total,
      notes: notes || null,
    })
    .select('id')
    .single()

  if (orderError || !order) {
    throw orderError ?? new Error('No se pudo crear el pedido')
  }

  const orderItems = items.map((item) => {
    const product = products.find((p) => p.id === item.product_id)!
    return {
      order_id: order.id,
      product_id: item.product_id,
      product_name: product.name,
      image_url: product.image_url,
      restaurant_id: product.restaurant_id,
      restaurant_name:
        (product.restaurants as unknown as { name: string } | { name: string }[] | null) instanceof Array
          ? (product.restaurants as unknown as { name: string }[])[0]?.name ?? null
          : (product.restaurants as unknown as { name: string } | null)?.name ?? null,
      quantity: item.quantity,
      unit_price: product.price,
    }
  })

  const { error: itemsError } = await client.from('order_items').insert(orderItems as any)
  if (itemsError) {
    await client.from('orders').delete().eq('id', order.id)
    throw itemsError
  }

  return successResponse({ orderId: order.id }, 201)
})