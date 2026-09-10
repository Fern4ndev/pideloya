import { successResponse, errorResponse, withApi } from '@/lib/api/response'
import { authenticateRequest, adminClient } from '@/lib/api/auth'
import type { Role } from '@/types/auth'

export const dynamic = 'force-dynamic'

export const GET = withApi(async (request: Request) => {
  const context = await authenticateRequest(request)
  const client = adminClient()
  const url = new URL(request.url)
  const roleFilter = url.searchParams.get('role')

  // Solo admin puede listar perfiles de todos.
  if (context.role !== 'ADMIN') {
    return errorResponse('Solo el admin puede listar usuarios', 403)
  }

  let query = client
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false })

  if (roleFilter) query = query.eq('role', roleFilter as Role)

  const { data, error } = await query
  if (error) throw error
  return successResponse(data)
})