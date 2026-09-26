import { withApi, successResponse, errorResponse } from '@/lib/api/response'
import { authenticateRequest, adminClient } from '@/lib/api/auth'
import { createClient } from '@/lib/db/server'

export const dynamic = 'force-dynamic'

export const GET = withApi(async (request: Request) => {
  const url = new URL(request.url)
  const restaurantId = url.searchParams.get('restaurant_id')
  const authHeader = request.headers.get('authorization')

  // Sin token: solo productos disponibles de restaurantes aprobados/activos.
  if (!authHeader) {
    const supabase = await createClient()
    let query = supabase
      .from('products')
      .select(
        'id, name, description, price, image_url, available, category_id, restaurant_id'
      )
      .eq('available', true)

    if (restaurantId) query = query.eq('restaurant_id', restaurantId)
    const { data, error } = await query.order('name')
    if (error) throw error
    return successResponse(data)
  }

  const context = await authenticateRequest(request)
  const client = adminClient()

  // ADMIN: puede filtrar por restaurante o ver todos.
  if (context.role === 'ADMIN') {
    let query = client.from('products').select(
      'id, name, description, price, image_url, available, category_id, restaurant_id'
    )
    if (restaurantId) query = query.eq('restaurant_id', restaurantId)
    const { data, error } = await query.order('name')
    if (error) throw error
    return successResponse(data)
  }

  // RESTAURANT owner: solo productos de su(s) restaurante(s).
  if (context.role === 'RESTAURANT') {
    const { data: members } = await client
      .from('restaurant_members')
      .select('restaurant_id')
      .eq('user_id', context.profileId)
    const ids = (members ?? []).map((m) => m.restaurant_id)
    if (ids.length === 0) return successResponse([])

    let query = client
      .from('products')
      .select(
        'id, name, description, price, image_url, available, category_id, restaurant_id'
      )
      .in('restaurant_id', ids)

    if (restaurantId) query = query.eq('restaurant_id', restaurantId)
    const { data, error } = await query.order('name')
    if (error) throw error
    return successResponse(data)
  }

  // CUSTOMER: solo productos disponibles. DELIVERY ya no entra aquí: la
  // policy products_select_customer lo excluye (allowlist anon/CUSTOMER/ADMIN),
  // así que para un token de reparto la query devuelve lista vacía.
  const supabase = await createClient()
  let query = supabase
    .from('products')
    .select(
      'id, name, description, price, image_url, available, category_id, restaurant_id'
    )
    .eq('available', true)
  if (restaurantId) query = query.eq('restaurant_id', restaurantId)
  const { data, error } = await query.order('name')
  if (error) throw error
  return successResponse(data)
})

export const POST = withApi(async (request: Request) => {
  const context = await authenticateRequest(request)
  const client = adminClient()

  const body = await request.json().catch(() => null)
  if (!body) return errorResponse('Cuerpo inválido', 400)

  const {
    restaurant_id: restaurantId,
    name,
    description,
    price,
    image_url,
    available,
    category_id,
  } = body as {
    restaurant_id?: string
    name?: string
    description?: string | null
    price?: number
    image_url?: string | null
    available?: boolean
    category_id?: string | null
  }

  if (!name || typeof price !== 'number' || price <= 0 || !restaurantId) {
    return errorResponse(
      'name, price (>0) y restaurant_id son obligatorios',
      400
    )
  }

  // El dueño del restaurante solo puede crear productos en SU restaurante.
  if (context.role === 'RESTAURANT') {
    const { data: member } = await client
      .from('restaurant_members')
      .select('restaurant_id')
      .eq('user_id', context.profileId)
      .eq('restaurant_id', restaurantId)
      .maybeSingle()
    if (!member) return errorResponse('No eres miembro de ese restaurante', 403)
  }

  const { data, error } = await client
    .from('products')
    .insert({
      restaurant_id: restaurantId,
      name,
      description: description ?? null,
      price,
      image_url: image_url ?? null,
      available: available ?? true,
      category_id: category_id ?? null,
    })
    .select()
    .single()

  if (error) throw error
  return successResponse(data, 201)
})