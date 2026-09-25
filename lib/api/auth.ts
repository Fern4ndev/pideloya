import { createBearerClient, createServiceRoleClient } from '@/lib/db/server'
import type { Role } from '@/types/auth'

export interface AuthContext {
  userId: string
  profileId: string
  role: Role
  isActive: boolean
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string
  ) {
    super(message)
  }
}

export class ForbiddenError extends ApiError {
  constructor(message = 'No tienes permiso para realizar esta acción') {
    super(message, 403, 'forbidden')
  }
}

export class UnauthorizedError extends ApiError {
  constructor(message = 'Token inválido o expirado') {
    super(message, 401, 'unauthorized')
  }
}

export class NotFoundError extends ApiError {
  constructor(message = 'Recurso no encontrado') {
    super(message, 404, 'not_found')
  }
}

export class BadRequestError extends ApiError {
  constructor(message = 'Solicitud inválida') {
    super(message, 400, 'bad_request')
  }
}

/**
 * Autentica una petición API usando el Bearer token de Supabase.
 * El token viene en el header `Authorization: Bearer <jwt>`.
 *
 * Devuelve el contexto con el userId (auth.users.id), profileId
 * (public.profiles.id), rol e is_active. Lanza ApiError si el token
 * es inválido o la cuenta no tiene perfil.
 */
export async function authenticateRequest(request: Request): Promise<AuthContext> {
  const authHeader = request.headers.get('authorization')

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new UnauthorizedError('Falta el header Authorization: Bearer <token>')
  }

  const accessToken = authHeader.slice('Bearer '.length).trim()
  if (!accessToken) throw new UnauthorizedError()

  const supabase = createBearerClient(accessToken)

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(accessToken)

  if (error || !user) {
    throw new UnauthorizedError()
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, role, is_active')
    .eq('auth_id', user.id)
    .single()

  if (profileError || !profile) {
    throw new ForbiddenError('Cuenta sin perfil configurado')
  }

  if (!profile.is_active) {
    throw new ForbiddenError('Cuenta desactivada')
  }

  return {
    userId: user.id,
    profileId: profile.id as string,
    role: profile.role as Role,
    isActive: profile.is_active,
  }
}

/**
 * Verifica que el rol del usuario esté dentro de `allowedRoles`.
 * Lanza ForbiddenError si no lo está.
 */
export function requireRole(context: AuthContext, allowedRoles: Role[]) {
  if (!allowedRoles.includes(context.role)) {
    throw new ForbiddenError(`Requiere un rol con permisos de escritura`)
  }
  return context
}

/**
 * Cliente con service role. Solo para operaciones donde RLS no puede
 * cubrir al usuario (ej. admin viendo datos de todos los usuarios).
 * Exige verificando el rol antes de llegar aquí.
 */
export function adminClient() {
  return createServiceRoleClient()
}