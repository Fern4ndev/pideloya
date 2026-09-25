import { successResponse, errorResponse, withApi } from '@/lib/api/response'
import { authenticateRequest, adminClient } from '@/lib/api/auth'

export const dynamic = 'force-dynamic'

export const GET = withApi(async (request: Request) => {
  const context = await authenticateRequest(request)
  const client = adminClient()

  if (context.role === 'ADMIN') {
    const { data, error } = await client
      .from('addresses')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) throw error
    return successResponse(data)
  }

  const { data, error } = await client
    .from('addresses')
    .select('*')
    .eq('customer_id', context.profileId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return successResponse(data)
})

export const POST = withApi(async (request: Request) => {
  const context = await authenticateRequest(request)
  if (context.role !== 'CUSTOMER' && context.role !== 'ADMIN') {
    return errorResponse('Solo clientes pueden crear direcciones', 403)
  }

  const body = await request.json().catch(() => null)
  if (!body) return errorResponse('Cuerpo inválido', 400)

  const { address_text: addressText, label, reference, latitude, longitude } =
    body as {
      address_text?: string
      label?: string | null
      reference?: string | null
      latitude?: number
      longitude?: number
    }

  if (!addressText) {
    return errorResponse('address_text es obligatorio', 400)
  }

  if (
    typeof latitude !== 'number' ||
    typeof longitude !== 'number' ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    return errorResponse('latitude/longitude inválidas', 400)
  }

  const client = adminClient()
  const { data, error } = await client
    .from('addresses')
    .insert({
      customer_id:
        context.role === 'ADMIN' && body.customer_id
          ? (body.customer_id as string)
          : context.profileId,
      label: label ?? null,
      address_text: addressText,
      reference: reference ?? null,
      latitude,
      longitude,
    })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      return errorResponse(
        'Ya tienes una dirección guardada. Edita la dirección existente.',
        409
      )
    }
    throw error
  }
  return successResponse(data, 201)
})