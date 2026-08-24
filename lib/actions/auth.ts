'use server'

import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { createClient, createServiceRoleClient } from '@/lib/db/server'

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

/**
 * Cierra sesión y devuelve al usuario a la home pública.
 */
export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/')
}

/**
 * SOLO admin: invita a un restaurante o repartidor por email.
 * Usa el service role porque `auth.admin.inviteUserByEmail` no es
 * una operación que un usuario final pueda hacer — se salta RLS
 * a propósito, por eso la verificación de "soy admin" es manual aquí.
 */
export async function inviteRestaurantOrDelivery(input: {
  email: string
  fullName: string
  role: 'RESTAURANT' | 'DELIVERY'
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('No autenticado')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('auth_id', user.id)
    .single()

  if (profile?.role !== 'ADMIN') {
    throw new Error('Solo el administrador puede invitar usuarios')
  }

  const adminClient = createServiceRoleClient()
  const { error } = await adminClient.auth.admin.inviteUserByEmail(input.email, {
    data: {
      role: input.role,
      full_name: input.fullName,
    },
  })

  if (error) {
    throw new Error(`No se pudo enviar la invitación: ${error.message}`)
  }

  return { success: true }
}