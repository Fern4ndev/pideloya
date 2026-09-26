'use server'

import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { createClient } from '@/lib/db/server'

/**
 * Inicia el flujo de Google OAuth para clientes. Redirige al usuario
 * a Google; Google vuelve a /api/auth/callback, que intercambia el
 * código por una sesión y redirige al panel correspondiente.
 */
export async function signInWithGoogle(nextPath: string = '/cliente') {
  const supabase = await createClient()
  const origin = (await headers()).get('origin')

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${origin}/api/auth/callback?next=${encodeURIComponent(nextPath)}`,
    },
  })

  if (error || !data.url) {
    redirect('/login?error=oauth_init_failed')
  }

  redirect(data.url)
}

const ROLE_HOME: Record<string, string> = {
  CUSTOMER: '/cliente',
  RESTAURANT: '/restaurante',
  DELIVERY: '/repartidor',
  ADMIN: '/admin',
}

/**
 * Login con correo/contraseña — el método para RESTAURANT, DELIVERY y ADMIN.
 * Los clientes usan Google (signInWithGoogle); estos roles no.
 */
export async function signInWithPassword(input: { email: string; password: string }) {
  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword(input)

  if (error) {
    redirect('/login?error=invalid_credentials')
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, is_active')
    .eq('auth_id', user!.id)
    .single()

  if (!profile?.is_active) {
    // No lo dejamos "medio adentro": cierra la sesión y explica por qué.
    await supabase.auth.signOut()
    redirect('/login?error=account_inactive')
  }

  redirect(ROLE_HOME[profile.role] ?? '/')
}

/**
 * Se usa una sola vez, justo después de aceptar una invitación (ver
 * /establecer-contrasena). En ese punto el usuario ya tiene sesión
 * (gracias al intercambio de código en /api/auth/callback) pero
 * todavía no tiene contraseña — Supabase lo creó solo con email.
 */
export async function setInitialPassword(password: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { error } = await supabase.auth.updateUser({ password })
  if (error) {
    throw new Error(error.message)
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('auth_id', user.id)
    .single()

  redirect(ROLE_HOME[profile?.role ?? 'CUSTOMER'])
}
export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/')
}
