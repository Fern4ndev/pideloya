import { createServiceRoleClient } from '@/lib/db/server'

/**
 * Guardas del registro público (C4 del plan de optimización).
 *
 * Son Server Actions PÚBLICAS que crean usuarios de Auth: sin freno, un
 * script puede crear miles de cuentas huérfanas. Dos capas:
 *
 *  1. Rate limit por IP con la tabla `registration_attempts` (migración
 *     20261003120310): máx. 5 intentos por IP y hora. La tabla tiene RLS
 *     activada y SIN policies — solo el service_role de estas actions la
 *     toca; anon/authenticated no pueden leerla ni borrarla (fail-closed:
     nadie puede limpiar su propio contador desde el cliente).
 *  2. Turnstile OPCIONAL: si TURNSTILE_SECRET_KEY está configurada, se exige
 *     un token válido; si no, la verificación se omite y el rate limit es la
 *     única barrera (despliegue sin claves externas, decisión del plan).
 */

const MAX_ATTEMPTS_PER_HOUR = 5
const WINDOW_MS = 60 * 60 * 1000

/** IP del request de una Server Action (x-forwarded-for / x-real-ip). */
export function getClientIp(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for')
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim()
    if (first) return first
  }
  return headers.get('x-real-ip')?.trim() || 'desconocida'
}

/**
 * Registra el intento y rechaza si esta IP ya agotó su cupo de la hora.
 * Retención best-effort: borra intentos de más de 2 h en cada llamada para
 * que la tabla no crezca indefinidamente.
 */
export async function enforceRegistrationRateLimit(ip: string): Promise<void> {
  const admin = createServiceRoleClient()
  const since = new Date(Date.now() - WINDOW_MS).toISOString()

  // Limpieza best-effort de intentos antiguos (no bloquea el registro).
  void admin
    .from('registration_attempts')
    .delete()
    .lt('created_at', new Date(Date.now() - 2 * WINDOW_MS).toISOString())

  const { count, error } = await admin
    .from('registration_attempts')
    .select('id', { count: 'exact', head: true })
    .eq('ip', ip)
    .gte('created_at', since)

  if (!error && (count ?? 0) >= MAX_ATTEMPTS_PER_HOUR) {
    throw new Error(
      'Demasiados intentos de registro desde esta conexión. Espera una hora e inténtalo de nuevo.'
    )
  }

  // El intento se registra DESPUÉS del conteo: el request actual entra en el
  // cupo de los siguientes. Si el insert falla (BD caída), el registro sigue:
  // es un freno anti-abuso, no un requisito de negocio.
  await admin.from('registration_attempts').insert({ ip })
}

/**
 * Verifica el token de Cloudflare Turnstile SOLO si el servidor tiene
 * TURNSTILE_SECRET_KEY configurada. Sin clave, no-op (el widget tampoco se
 * renderiza en el cliente sin la site key — paridad deliberada).
 */
export async function verifyTurnstileToken(token: string | undefined): Promise<void> {
  const secret = process.env.TURNSTILE_SECRET_KEY
  if (!secret) return

  if (!token) {
    throw new Error('Completa la verificación anti-bot e inténtalo de nuevo.')
  }

  const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ secret, response: token }),
  })

  if (!response.ok) {
    throw new Error('No se pudo verificar la comprobación anti-bot. Inténtalo de nuevo.')
  }

  const result = (await response.json()) as { success?: boolean }
  if (!result.success) {
    throw new Error('La verificación anti-bot falló. Inténtalo de nuevo.')
  }
}
