import {
  successResponse,
  errorResponse,
  withApi,
  parseJsonBody,
} from '@/lib/api/response'
import { authenticateRequest, adminClient, NotFoundError } from '@/lib/api/auth'
import type { Database } from '@/types/database'

export const dynamic = 'force-dynamic'

type ProfileUpdate = Database['public']['Tables']['profiles']['Update']

interface RouteCtx {
  params: Promise<{ id: string }>
}

export const GET = withApi(async (_request: Request, ctx: RouteCtx) => {
  const { id } = await ctx.params
  const context = await authenticateRequest(_request)
  const client = adminClient()

  // Solo puedes ver tu propio perfil, o cualquier perfil si eres admin.
  if (context.role !== 'ADMIN' && context.profileId !== id) {
    return errorResponse('No puedes ver este perfil', 403)
  }

  const { data, error } = await client
    .from('profiles')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (error) throw error
  if (!data) throw new NotFoundError('Perfil no encontrado')
  return successResponse(data)
})

export const PUT = withApi(async (request: Request, ctx: RouteCtx) => {
  const { id } = await ctx.params
  const context = await authenticateRequest(request)
  const client = adminClient()

  // Solo puedes editar tu propio perfil, o cualquier perfil si eres admin.
  if (context.role !== 'ADMIN' && context.profileId !== id) {
    return errorResponse('No puedes editar este perfil', 403)
  }

  const body = await parseJsonBody(request)
  const allowed = [
    'full_name',
    'phone',
    'document_type',
    'document_number',
    'vehicle_type',
    'is_active',
  ]
  const update: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in body) update[key] = body[key]
  }

  // Solo admin puede cambiar is_active.
  if (context.role !== 'ADMIN') delete update.is_active

  if (Object.keys(update).length === 0) {
    return errorResponse('No hay campos para actualizar', 400)
  }

  const { data, error } = await client
    .from('profiles')
    .update(update as ProfileUpdate)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return successResponse(data)
})