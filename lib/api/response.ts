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

/**
 * Traduce a respuesta HTTP el error de una función RPC.
 *
 * Las funciones SQL del proyecto levantan excepciones con `errcode`
 * explícito justamente para poder distinguir la causa sin parsear el texto
 * del mensaje (ver `confirm_delivery_payment`/`offer_delivery`). El mensaje
 * viaja tal cual al cliente porque está escrito para mostrarse.
 */
export function rpcErrorResponse(error: { message: string; code?: string | null }) {
  const statusByCode: Record<string, number> = {
    '42501': 403, // insufficient_privilege: la función rechazó por identidad/rol
    P0002: 404, // no_data_found: no existe lo que se pidió retirar/leer
    '23505': 409, // unique_violation: conflicto con otra acción en curso
    '40001': 409, // serialization_failure: el estado cambió en paralelo
  }
  const status = (error.code && statusByCode[error.code]) || 400
  return errorResponse(error.message, status, error.code ?? undefined)
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