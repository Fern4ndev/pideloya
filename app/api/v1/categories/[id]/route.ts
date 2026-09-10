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

type CategoryUpdate = Database['public']['Tables']['categories']['Update']

interface RouteCtx {
  params: Promise<{ id: string }>
}

async function assertCanModify(
  context: Awaited<ReturnType<typeof authenticateRequest>>,
  categoryId: string
) {
  const client = adminClient()
  const { data: category } = await client
    .from('categories')
    .select('restaurant_id')
    .eq('id', categoryId)
    .maybeSingle()
  if (!category) throw new NotFoundError('Categoría no encontrada')

  if (context.role === 'ADMIN') return

  if (context.role === 'RESTAURANT') {
    const { data: member } = await client
      .from('restaurant_members')
      .select('restaurant_id')
      .eq('user_id', context.profileId)
      .eq('restaurant_id', category.restaurant_id)
      .maybeSingle()
    if (!member) throw new ForbiddenError()
    return
  }

  throw new ForbiddenError()
}

export const GET = withApi(async (_request: Request, ctx: RouteCtx) => {
  const { id } = await ctx.params
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (error) throw error
  if (!data) throw new NotFoundError('Categoría no encontrada')
  return successResponse(data)
})

export const PUT = withApi(async (request: Request, ctx: RouteCtx) => {
  const { id } = await ctx.params
  const context = await authenticateRequest(request)
  await assertCanModify(context, id)

  const body = await parseJsonBody(request)
  const client = adminClient()

  const allowed = ['name', 'sort_order']
  const update: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in body) update[key] = body[key]
  }

  if (Object.keys(update).length === 0) {
    return errorResponse('No hay campos para actualizar', 400)
  }

  const { data, error } = await client
    .from('categories')
    .update(update as CategoryUpdate)
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

  // Los productos que usaban esta categoría quedan con category_id null
  // (FK "on delete set null" en products).
  const client = adminClient()
  const { error } = await client.from('categories').delete().eq('id', id)
  if (error) throw error
  return successResponse({ message: 'Categoría eliminada' })
})