import { successResponse, errorResponse, withApi } from '@/lib/api/response'
import { authenticateRequest, adminClient } from '@/lib/api/auth'

export const dynamic = 'force-dynamic'

export const GET = withApi(async (request: Request) => {
  const context = await authenticateRequest(request)
  const client = adminClient()

  if (context.role === 'ADMIN') {
    const { data, error } = await client
      .from('deliveries')
      .select('*, orders(*)')
      .order('accepted_at', { ascending: false })
      .limit(100)
    if (error) throw error
    return successResponse(data)
  }

  if (context.role === 'DELIVERY') {
    const { data, error } = await client
      .from('deliveries')
      .select('*, orders(*)')
      .eq('delivery_person_id', context.profileId)
      .order('accepted_at', { ascending: false })
      .limit(100)
    if (error) throw error
    return successResponse(data)
  }

  return errorResponse('Acción no permitida', 403)
})