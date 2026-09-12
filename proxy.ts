import { type NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

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
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
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

  response.headers.set('x-user-role', role)
  response.headers.set('x-user-active', String(profile.is_active))
  response.headers.set('x-user-id', user.id)
  response.headers.set('x-user-name', profile.full_name ?? '')

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