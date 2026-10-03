import { cache } from 'react'
import { createClient } from '@/lib/db/server'
import type { Role } from '@/types/auth'

export interface SessionContext {
  authId: string
  profileId: string
  role: Role
  isActive: boolean
  /** Email del claim del JWT (no se consulta a Auth). */
  email: string | null
}

/**
 * Contexto de sesión del request actual (Server Components y Server Actions).
 *
 * `cache()` de React deduplica TODAS las llamadas dentro del mismo request:
 * antes cada action/componente repetía la cadena getUser() + profiles (2
 * consultas por llamada, y se llamaba 3-5 veces por render); ahora la cadena
 * corre UNA vez por request y el resto recibe el resultado cacheado.
 *
 * getClaims() (supabase-js ≥ 2.45) resuelve y verifica el JWT localmente con
 * las claves asimétricas de Auth — sin viaje redondo a Auth como getUser().
 * El perfil SÍ se consulta: profiles.role/is_active son el source of truth
 * (el admin puede cambiarlos y el JWT queda viejo hasta el próximo refresh).
 */
export const getSessionContext = cache(
  async (): Promise<SessionContext | null> => {
    const supabase = await createClient()

    // getClaims() devuelve una unión {data:{claims},error:null} | {data:null,...}:
    // se extrae en dos pasos para que TS esté satisfecho con el null.
    const { data } = await supabase.auth.getClaims()
    const claims = data?.claims
    if (!claims?.sub) return null

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, role, is_active')
      .eq('auth_id', claims.sub)
      .single()

    if (!profile) return null

    return {
      authId: claims.sub,
      profileId: profile.id as string,
      role: profile.role as Role,
      isActive: profile.is_active,
      email: (claims as { email?: string }).email ?? null,
    }
  }
)

/**
 * profileId del request actual. Lanza si no hay sesión — mismo contrato que
 * las helpers duplicadas que reemplaza (getMyProfileId locales).
 */
export const getMyProfileId = cache(async (): Promise<string> => {
  const session = await getSessionContext()
  if (!session) throw new Error('No autenticado')
  return session.profileId
})

/**
 * restaurant_id que administra el usuario actual, o null si no administra
 * ninguno (o no hay sesión). Los actions lanzan SU mensaje propio encima.
 */
export const getMyRestaurantIdOrNull = cache(async (): Promise<string | null> => {
  const session = await getSessionContext()
  if (!session) return null

  const supabase = await createClient()
  const { data: member } = await supabase
    .from('restaurant_members')
    .select('restaurant_id')
    .eq('user_id', session.profileId)
    .limit(1)
    .maybeSingle()

  return member?.restaurant_id ?? null
})
