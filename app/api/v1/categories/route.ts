import { withApi, successResponse, errorResponse } from '@/lib/api/response'
import { authenticateRequest, adminClient } from '@/lib/api/auth'
import { createClient } from '@/lib/db/server'

export const dynamic = 'force-dynamic'

export const GET = withApi(async (request: Request) => {
  const url = new URL(request.url)
  const restaurantId = url.searchParams.get('restaurant_id')
  const authHeader = request.headers.get('authorization')

  const supabase = await createClient()

  if (!authHeader) {
    let query = supabase.from('categories').select('*').order('sort_order')
    if (restaurantId) query = query.eq('restaurant_id', restaurantId)
    const { data, error } = await query
    if (error) throw error
    return successResponse(data)
  }

  const context = await authenticateRequest(request)
  const client = adminClient()

  if (context.role === 'ADMIN') {
    let query = client.from('categories').select('*').order('sort_order')
    if (restaurantId) query = query.eq('restaurant_id', restaurantId)
    const { data, error } = await query
    if (error) throw error
    return successResponse(data)
  }

  if (context.role === 'RESTAURANT') {
    const { data: members } = await client
      .from('restaurant_members')
      .select('restaurant_id')
      .eq('user_id', context.profileId)
    const ids = (members ?? []).map((m) => m.restaurant_id)
    if (ids.length === 0) return successResponse([])

    let query = client
      .from('categories')
      .select('*')
      .in('restaurant_id', ids)
      .order('sort_order')
    if (restaurantId) query = query.eq('restaurant_id', restaurantId)
    const { data, error } = await query
    if (error) throw error
    return successResponse(data)
  }

  let query = supabase.from('categories').select('*').order('sort_order')
  if (restaurantId) query = query.eq('restaurant_id', restaurantId)
  const { data, error } = await query
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
    sort_order: sortOrder,
  } = body as {
    restaurant_id?: string
    name?: string
    sort_order?: number
  }

  if (!name || !restaurantId) {
    return errorResponse('name y restaurant_id son obligatorios', 400)
  }

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
    .from('categories')
    .insert({ restaurant_id: restaurantId, name, sort_order: sortOrder ?? 0 })
    .select()
    .single()

  if (error) throw error
  return successResponse(data, 201)
})