import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from '@/types/database'

/**
 * Cliente de Supabase para Server Components y Server Actions
 * (lib/actions/*.ts). Lee y escribe la sesión desde las cookies
 * del request actual.
 *
 * Se crea uno NUEVO por request (no es un singleton global) porque
 * cada request tiene sus propias cookies de sesión.
 */
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // `setAll` puede lanzar error si se llama desde un Server
            // Component (no puede escribir cookies). Es seguro ignorarlo
            // si tienes el middleware refrescando la sesión (ver middleware.ts).
          }
        },
      },
    }
  )
}

/**
 * Cliente con el service role: se salta RLS por completo.
 * ÚSALO SOLO para operaciones administrativas específicas donde
 * ningún usuario final tiene permisos aún — ej. crear el primer
 * `restaurant` + `restaurant_member` durante el registro, antes de
 * que exista la relación que las policies de RLS necesitan.
 *
 * NUNCA lo importes en código que corra en el navegador.
 */
/**
 * Cliente para rutas API que se autentican con `Authorization: Bearer`.
 * No lee cookies: adjunta el access token validado a cada query, para que
 * PostgREST opere como `authenticated` y las policies (auth.uid()) apliquen
 * igual que en el navegador. Sin esto, un cliente sin cookies (curl, apps
 * móviles, scripts de test) recibía 403 "Cuenta sin perfil configurado".
 */
export function createBearerClient(accessToken: string) {
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return []
        },
        setAll() {},
      },
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    }
  )
}

export function createServiceRoleClient() {
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll() {
          return []
        },
        setAll() {
          // El cliente de service role no maneja sesión de usuario.
        },
      },
    }
  )
}