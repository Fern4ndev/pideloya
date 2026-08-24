import { type NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

/**
 * Roles del sistema. Deben coincidir exactamente con el enum `role`
 * de la tabla `profiles` en Postgres (ver supabase/migrations).
 */
type Role = 'CUSTOMER' | 'RESTAURANT' | 'DELIVERY' | 'ADMIN'

/** Prefijo de ruta protegida → rol que la puede acceder. */
const ROUTE_ROLES: Record<string, Role> = {
  '/cliente': 'CUSTOMER',
  '/restaurante': 'RESTAURANT',
  '/repartidor': 'DELIVERY',
  '/admin': 'ADMIN',
}

/** A dónde mandamos a un usuario si entra a un panel que no es el suyo. */
const ROLE_HOME: Record<Role, string> = {
  CUSTOMER: '/cliente',
  RESTAURANT: '/restaurante',
  DELIVERY: '/repartidor',
  ADMIN: '/admin',
}

function matchProtectedPrefix(pathname: string): string | undefined {
  return Object.keys(ROUTE_ROLES).find(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  )
}

export async function proxy(request: NextRequest) {
  // response mutable: Supabase necesita poder refrescar cookies de sesión
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          // 1. actualizar cookies en el request (para que el resto del
          //    pipeline de este mismo request las vea)
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          // 2. reconstruir la respuesta y setear cookies ahí también
          //    (para que el navegador reciba la sesión refrescada)
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { pathname } = request.nextUrl
  const protectedPrefix = matchProtectedPrefix(pathname)

  // Ruta pública: no hace falta tocar la sesión, seguir de largo.
  if (!protectedPrefix) {
    return response
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('next', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // El rol NO vive en auth.users: vive en public.profiles, relacionado
  // por auth_id. Es la misma fuente que consultan las políticas RLS.
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, is_active')
    .eq('auth_id', user.id)
    .single()

  if (!profile || !profile.is_active) {
    // Sin perfil o cuenta desactivada (ej. restaurante/repartidor
    // aún no aprobado por el admin): fuera.
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('error', 'account_inactive')
    return NextResponse.redirect(loginUrl)
  }

  const role = profile.role as Role
  const requiredRole = ROUTE_ROLES[protectedPrefix]

  if (role !== requiredRole) {
    // Sesión válida pero panel equivocado → lo mandamos a SU panel,
    // no a login (ya está autenticado).
    return NextResponse.redirect(new URL(ROLE_HOME[role], request.url))
  }

  return response
}

/**
 * El middleware solo corre sobre los paneles protegidos.
 * El sitio público, login/registro y assets estáticos no pasan por aquí.
 */
export const config = {
  matcher: [
    '/cliente/:path*',
    '/restaurante/:path*',
    '/repartidor/:path*',
    '/admin/:path*',
  ],
}