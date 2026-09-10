import {
  withApi,
  successResponse,
  errorResponse,
  parseJsonBody,
} from '@/lib/api/response'
import {
  authenticateRequest,
  adminClient,
  NotFoundError,
  ForbiddenError,
} from '@/lib/api/auth'
import { createClient } from '@/lib/db/server'
import type { Database } from '@/types/database'

export const dynamic = 'force-dynamic'

type ProductUpdate = Database['public']['Tables']['products']['Update']

interface RouteCtx {
  params: Promise<{ id: string }>
}

export const GET = withApi(async (_request: Request, ctx: RouteCtx) => {
  const { id } = await ctx.params
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (error) throw error
  if (!data) throw new NotFoundError('Producto no encontrado')
  if (!data.available) throw new NotFoundError('Producto no encontrado')
  return successResponse(data)
})

async function assertCanModify(context: Awaited<ReturnType<typeof authenticateRequest>>, productId: string) {
  const client = adminClient()

  const { data: product } = await client
    .from('products')
    .select('restaurant_id')
    .eq('id', productId)
    .maybeSingle()
  if (!product) throw new NotFoundError('Producto no encontrado')

  if (context.role === 'ADMIN') return

  if (context.role === 'RESTAURANT') {
    const { data: member } = await client
      .from('restaurant_members')
      .select('restaurant_id')
      .eq('user_id', context.profileId)
      .eq('restaurant_id', product.restaurant_id)
      .maybeSingle()
    if (!member) throw new ForbiddenError()
    return
  }

  throw new ForbiddenError()
}

export const PUT = withApi(async (request: Request, ctx: RouteCtx) => {
  const { id } = await ctx.params
  const context = await authenticateRequest(request)
  await assertCanModify(context, id)

  const body = await parseJsonBody(request)
  const client = adminClient()

  const allowed = [
    'name',
    'description',
    'price',
    'image_url',
    'available',
    'category_id',
  ]
  const update: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in body) update[key] = body[key]
  }

  if (typeof update.price === 'number' && update.price <= 0) {
    return errorResponse('price debe ser mayor a 0', 400)
  }

  if (Object.keys(update).length === 0) {
    return errorResponse('No hay campos para actualizar', 400)
  }

  const { data, error } = await client
    .from('products')
    .update(update as ProductUpdate)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return successResponse(data)
})

export const DELETE = withApi(async (_request: Request, ctx: RouteCtx) => {
  const { id } = await ctx.params
  const context = await authenticateRequest(_request)
  await assertCanModify(context, id)

  const client = adminClient()
  const { error } = await client.from('products').delete().eq('id', id)
  if (error) throw error
  return successResponse({ message: 'Producto eliminado' })
})