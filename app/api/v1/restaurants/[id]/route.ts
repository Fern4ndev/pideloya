import {
  withApi,
  successResponse,
  errorResponse,
  parseJsonBody,
} from '@/lib/api/response'
import {
  authenticateRequest,
  requireRole,
  adminClient,
  NotFoundError,
  ForbiddenError,
} from '@/lib/api/auth'
import { createClient } from '@/lib/db/server'
import type { Database } from '@/types/database'

export const dynamic = 'force-dynamic'

type RestaurantUpdate = Database['public']['Tables']['restaurants']['Update']

interface RouteCtx {
  params: Promise<{ id: string }>
}

export const GET = withApi(async (request: Request, ctx: RouteCtx) => {
  const { id } = await ctx.params
  const authHeader = request.headers.get('authorization')

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('restaurants')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (error) throw error
  if (!data) throw new NotFoundError('Restaurante no encontrado')

  // Sin autenticar: solo restaurantes aprobados y activos.
  if (!authHeader) {
    if (!data.is_approved || !data.is_active) {
      throw new NotFoundError('Restaurante no encontrado')
    }
    return successResponse(data)
  }

  const context = await authenticateRequest(request)

  // Admin ve todo.
  if (context.role === 'ADMIN') return successResponse(data)

  // Dueño del restaurante ve su restaurante aunque no esté aprobado.
  if (context.role === 'RESTAURANT') {
    const client = adminClient()
    const { data: member } = await client
      .from('restaurant_members')
      .select('restaurant_id')
      .eq('user_id', context.profileId)
      .eq('restaurant_id', id)
      .maybeSingle()

    if (member) return successResponse(data)
    throw new ForbiddenError()
  }

  if (!data.is_approved || !data.is_active) {
    throw new NotFoundError('Restaurante no encontrado')
  }
  return successResponse(data)
})

export const PUT = withApi(async (request: Request, ctx: RouteCtx) => {
  const { id } = await ctx.params
  const context = await authenticateRequest(request)
  const client = adminClient()
  const body = await parseJsonBody(request)

  const { data: existing } = await client
    .from('restaurants')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (!existing) throw new NotFoundError('Restaurante no encontrado')

  // Solo un ADMIN o el dueño del restaurante pueden editarlo.
  if (context.role === 'ADMIN') {
    // ok
  } else if (context.role === 'RESTAURANT') {
    const { data: member } = await client
      .from('restaurant_members')
      .select('restaurant_id')
      .eq('user_id', context.profileId)
      .eq('restaurant_id', id)
      .maybeSingle()
    if (!member) throw new ForbiddenError()
  } else {
    throw new ForbiddenError()
  }

  const allowed = [
    'name',
    'description',
    'address_text',
    'latitude',
    'longitude',
    'whatsapp',
    'food_type',
    'is_approved',
    'is_active',
  ]

  const update: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in body) update[key] = body[key]
  }

  // Solo el admin puede tocar flags de aprobación/activación.
  if (context.role !== 'ADMIN') {
    delete update.is_approved
    delete update.is_active
  }

  // Si cambia el nombre, regenera el slug.
  if (typeof update.name === 'string' && update.name !== existing.name) {
    const base = update.name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
      .slice(0, 60)

    const { data: collision } = await client
      .from('restaurants')
      .select('id')
      .eq('slug', base)
      .neq('id', id)
      .maybeSingle()

    update.slug = collision
      ? `${base}-${Math.random().toString(36).slice(2, 7)}`
      : base
  }

  if (Object.keys(update).length === 0) {
    return errorResponse('No hay campos para actualizar', 400)
  }

  const { data, error } = await client
    .from('restaurants')
    .update(update as RestaurantUpdate)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return successResponse(data)
})

export const DELETE = withApi(async (_request: Request, ctx: RouteCtx) => {
  const { id } = await ctx.params
  const context = await authenticateRequest(_request)
  requireRole(context, ['ADMIN'])

  const client = adminClient()

  // Si el restaurante tiene pedidos referenciados, el FK lo protegerá;
  // desactivamos en ese caso en vez de borrar en cascada.
  const { data: hasOrders } = await client
    .from('order_items')
    .select('restaurant_id')
    .eq('restaurant_id', id)
    .limit(1)
    .maybeSingle()

  if (hasOrders) {
    const { error } = await client
      .from('restaurants')
      .update({ is_active: false, is_approved: false })
      .eq('id', id)
    if (error) throw error
    return successResponse({
      message: 'Restaurante con pedidos: se desactivó en lugar de eliminar',
      softDeleted: true,
    })
  }

  const { data: members } = await client
    .from('restaurant_members')
    .select('user_id')
    .eq('restaurant_id', id)

  const { error } = await client.from('restaurants').delete().eq('id', id)
  if (error) throw error

  if (members && members.length > 0) {
    await client
      .from('profiles')
      .update({ is_active: false })
      .in('id', members.map((m) => m.user_id))
  }

  return successResponse({ message: 'Restaurante eliminado' })
})