import { NextResponse } from 'next/server'
import { ApiError } from '@/lib/api/auth'

/** Respuesta exitosa: `{ success: true, data }`. */
export function successResponse<T>(data: T, status = 200) {
  return NextResponse.json({ success: true, data }, {
    status,
    headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
  })
}

/** Respuesta de error genérica. */
export function errorResponse(message: string, status = 400, code?: string) {
  return NextResponse.json(
    { success: false, error: message, code },
    { status }
  )
}

/**
 * Envuelve un handler de ruta para capturar ApiError y errores
 * inesperados, devolviendo JSON consistente.
 */
export function withApi<TArgs extends unknown[]>(
  handler: (...args: TArgs) => Promise<Response>
) {
  return async (...args: TArgs): Promise<Response> => {
    try {
      return await handler(...args)
    } catch (err) {
      if (err instanceof ApiError) {
        return errorResponse(err.message, err.status, err.code)
      }
      if (err instanceof SyntaxError) {
        return errorResponse('JSON inválido en el body', 400, 'invalid_json')
      }
      console.error('[api] error no controlado:', err)
      return errorResponse('Error interno del servidor', 500, 'internal_error')
    }
  }
}

export async function parseJsonBody(request: Request): Promise<Record<string, unknown>> {
  try {
    const body = await request.json()
    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
      throw new SyntaxError('body no es un objeto')
    }
    return body as Record<string, unknown>
  } catch {
    throw new ApiError('JSON inválido en el body', 400, 'invalid_json')
  }
}