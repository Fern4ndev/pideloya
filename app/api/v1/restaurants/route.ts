import { withApi, successResponse, errorResponse } from '@/lib/api/response'
import {
  authenticateRequest,
  requireRole,
  adminClient,
} from '@/lib/api/auth'
import { createClient } from '@/lib/db/server'

export const dynamic = 'force-dynamic'

export const GET = withApi(async (request: Request) => {
  const authHeader = request.headers.get('authorization')

  // Sin token → consulta pública: solo restaurantes aprobados y activos.
  if (!authHeader) {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('restaurants')
      .select('*')
      .eq('is_approved', true)
      .eq('is_active', true)
      .order('name')

    if (error) throw error
    return successResponse(data)
  }

  const context = await authenticateRequest(request)

  // Admin: ve todos los restaurantes (aprobados o no, activos o no).
  if (context.role === 'ADMIN') {
    const client = adminClient()
    const { data, error } = await client
      .from('restaurants')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) throw error
    return successResponse(data)
  }

  // RESTAURANT owner: ve solo el suyo.
  if (context.role === 'RESTAURANT') {
    const client = adminClient()
    const { data: members } = await client
      .from('restaurant_members')
      .select('restaurant_id')
      .eq('user_id', context.profileId)

    const ids = (members ?? []).map((m) => m.restaurant_id)
    if (ids.length === 0) return successResponse([])

    const { data, error } = await client
      .from('restaurants')
      .select('*')
      .in('id', ids)

    if (error) throw error
    return successResponse(data)
  }

  // CUSTOMER / DELIVERY: solo aprobados y activos.
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('restaurants')
    .select('*')
    .eq('is_approved', true)
    .eq('is_active', true)
    .order('name')

  if (error) throw error
  return successResponse(data)
})

export const POST = withApi(async (request: Request) => {
  const context = await authenticateRequest(request)
  requireRole(context, ['ADMIN'])

  const body = await request.json().catch(() => null)
  if (!body) {
    return errorResponse('Cuerpo inválido', 400)
  }

  const {
    name,
    description,
    address_text: addressText,
    latitude,
    longitude,
    whatsapp,
    food_type: foodType,
  } = body as {
    name?: string
    description?: string | null
    address_text?: string
    latitude?: number | null
    longitude?: number | null
    whatsapp?: string | null
    food_type?: string
  }

  if (!name || !foodType || !addressText) {
    return errorResponse('name, food_type y address_text son obligatorios', 400)
  }

  const client = adminClient()

  const slug = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 60)

  const { data: collision } = await client
    .from('restaurants')
    .select('id')
    .eq('slug', slug)
    .maybeSingle()

  const finalSlug = collision
    ? `${slug}-${Math.random().toString(36).slice(2, 7)}`
    : slug

  const { data, error } = await client
    .from('restaurants')
    .insert({
      name,
      slug: finalSlug,
      description: description || null,
      address_text: addressText,
      latitude: latitude ?? null,
      longitude: longitude ?? null,
      whatsapp: whatsapp || null,
      food_type: foodType,
      is_approved: true,
      is_active: true,
    })
    .select()
    .single()

  if (error) throw error
  return successResponse(data, 201)
})