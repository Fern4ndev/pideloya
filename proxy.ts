import { type NextRequest, NextResponse } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'

const USER_HEADER_NAMES = ['x-user-role', 'x-user-active', 'x-user-id', 'x-user-name']

/**
 * Copia los request headers SIN las x-user-*: un cliente no puede inyectar
 * su propia identidad. Se re-aplican con los valores REALES de la sesión
 * justo antes de responder (solo rutas protegidas las necesitan).
 */
function sanitizeUserHeaders(request: NextRequest): Headers {
  const headers = new Headers(request.headers)
  for (const name of USER_HEADER_NAMES) headers.delete(name)
  return headers
}

type Role = 'CUSTOMER' | 'RESTAURANT' | 'DELIVERY' | 'ADMIN'

const ROUTE_ROLES: Record<string, Role> = {
  '/cliente': 'CUSTOMER',
  '/restaurante': 'RESTAURANT',
  '/repartidor': 'DELIVERY',
  '/admin': 'ADMIN',
}

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
  let response = NextResponse.next({
    request: { headers: sanitizeUserHeaders(request) },
  })
  // Cookies refrescadas por setAll durante las consultas: se re-aplican a la
  // respuesta FINAL, porque se recrea con los request headers de identidad.
  let stagedCookies: { name: string; value: string; options?: CookieOptions }[] = []

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          stagedCookies = cookiesToSet
          response = NextResponse.next({
            request: { headers: sanitizeUserHeaders(request) },
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { pathname } = request.nextUrl
  const protectedPrefix = matchProtectedPrefix(pathname)

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

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, is_active, full_name')
    .eq('auth_id', user.id)
    .single()

  if (!profile || !profile.is_active) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('error', 'account_inactive')
    return NextResponse.redirect(loginUrl)
  }

  const role = profile.role as Role
  const requiredRole = ROUTE_ROLES[protectedPrefix]

  if (role !== requiredRole) {
    return NextResponse.redirect(new URL(ROLE_HOME[role], request.url))
  }

  // H8: la identidad viaja en los REQUEST headers — `headers()` en los
  // layouts (cliente/restaurante/repartidor/admin) lee los del REQUEST, no
  // los de la respuesta. El código anterior los seteaba en la RESPUESTA y
  // ningún Server Component los veía: el gate era doble (redirect aquí +
  // redirect a /login del layout) pero la sesión nunca llegaba a la página.
  // El refresh de sesión de arriba sigue intacto: request.cookies ya quedó
  // mutado (los nuevos valores viajan en el header cookie) y stagedCookies
  // re-aplica los Set-Cookie al navegador en la respuesta final.
  const requestHeaders = sanitizeUserHeaders(request)
  requestHeaders.set('x-user-role', role)
  requestHeaders.set('x-user-active', String(profile.is_active))
  requestHeaders.set('x-user-id', user.id)
  requestHeaders.set('x-user-name', profile.full_name ?? '')

  response = NextResponse.next({ request: { headers: requestHeaders } })
  stagedCookies.forEach(({ name, value, options }) =>
    response.cookies.set(name, value, options)
  )

  return response
}

export const config = {
  matcher: [
    '/cliente/:path*',
    '/restaurante/:path*',
    '/repartidor/:path*',
    '/admin/:path*',
  ],
}