import {
  successResponse,
  errorResponse,
  withApi,
  parseJsonBody,
} from '@/lib/api/response'
import {
  authenticateRequest,
  adminClient,
  NotFoundError,
} from '@/lib/api/auth'
import type { Database } from '@/types/database'

export const dynamic = 'force-dynamic'

type AddressUpdate = Database['public']['Tables']['addresses']['Update']

interface RouteCtx {
  params: Promise<{ id: string }>
}

async function assertCanModify(
  context: Awaited<ReturnType<typeof authenticateRequest>>,
  address: { customer_id: string | null }
) {
  if (context.role === 'ADMIN') return
  if (address.customer_id === context.profileId) return
  throw new NotFoundError('Dirección no encontrada')
}

export const GET = withApi(async (_request: Request, ctx: RouteCtx) => {
  const { id } = await ctx.params
  const context = await authenticateRequest(_request)
  const client = adminClient()

  const { data, error } = await client
    .from('addresses')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (error) throw error
  if (!data) throw new NotFoundError('Dirección no encontrada')

  await assertCanModify(context, data)
  return successResponse(data)
})

export const PUT = withApi(async (request: Request, ctx: RouteCtx) => {
  const { id } = await ctx.params
  const context = await authenticateRequest(request)
  const client = adminClient()

  const { data: existing } = await client
    .from('addresses')
    .select('customer_id')
    .eq('id', id)
    .maybeSingle()
  if (!existing) throw new NotFoundError('Dirección no encontrada')
  await assertCanModify(context, existing)

  const body = await parseJsonBody(request)
  const allowed = ['label', 'address_text', 'reference', 'latitude', 'longitude']
  const update: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in body) update[key] = body[key]
  }

  if (typeof update.latitude === 'number' && (update.latitude < -90 || update.latitude > 90)) {
    return errorResponse('latitude inválida', 400)
  }
  if (typeof update.longitude === 'number' && (update.longitude < -180 || update.longitude > 180)) {
    return errorResponse('longitude inválida', 400)
  }

  if (Object.keys(update).length === 0) {
    return errorResponse('No hay campos para actualizar', 400)
  }

  const { data, error } = await client
    .from('addresses')
    .update(update as AddressUpdate)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return successResponse(data)
})

export const DELETE = withApi(async (_request: Request, ctx: RouteCtx) => {
  const { id } = await ctx.params
  const context = await authenticateRequest(_request)
  const client = adminClient()

  const { data: existing } = await client
    .from('addresses')
    .select('customer_id')
    .eq('id', id)
    .maybeSingle()
  if (!existing) throw new NotFoundError('Dirección no encontrada')
  await assertCanModify(context, existing)

  const { error } = await client.from('addresses').delete().eq('id', id)
  if (error) throw error
  return successResponse({ message: 'Dirección eliminada' })
})