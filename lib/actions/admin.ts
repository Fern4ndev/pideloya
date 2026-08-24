'use server'

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { z } from 'zod'
import { createClient, createServiceRoleClient } from '@/lib/db/server'

/**
 * Convierte cualquier texto en un slug válido para la URL:
 * quita tildes, pasa a minúsculas, reemplaza espacios por guiones
 * y elimina cualquier carácter que no sea letra/número/guión.
 * Así el admin nunca tiene que escribir el slug "a mano" en el
 * formato correcto — solo escribe el nombre del negocio.
 */
function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // quita tildes (á -> a)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

/** Convierte cualquier error (Zod u otro) en un mensaje legible de una línea. */
function toFriendlyMessage(err: unknown): string {
  if (err instanceof z.ZodError) {
    return err.issues.map((issue) => issue.message).join(' ')
  }
  if (err instanceof Error) {
    return err.message
  }
  return 'Algo salió mal'
}

async function assertIsAdmin() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('No autenticado')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('auth_id', user.id)
    .single()

  if (profile?.role !== 'ADMIN') {
    throw new Error('Solo el administrador puede realizar esta acción')
  }
}

// ----------------------------------------------------------------------------
// RESTAURANTES
// ----------------------------------------------------------------------------
const inviteRestaurantSchema = z.object({
  restaurantName: z.string().min(2, 'Nombre muy corto'),
  // Ya no se valida con regex: se normaliza automáticamente con slugify,
  // así que cualquier texto que escriba el admin se convierte en un slug
  // válido (sin importar mayúsculas, tildes o espacios).
  slug: z
    .string()
    .min(2, 'Slug muy corto')
    .transform(slugify)
    .refine((val) => val.length >= 2, 'El slug quedó vacío después de limpiarlo'),
  addressText: z.string().min(3, 'Ingresa una dirección'),
  ownerEmail: z.string().email('Correo inválido'),
  ownerFullName: z.string().min(2, 'Nombre muy corto'),
})

export async function inviteRestaurantOwner(
  input: z.infer<typeof inviteRestaurantSchema>
) {
  await assertIsAdmin()

  let data: z.output<typeof inviteRestaurantSchema>
  try {
    data = inviteRestaurantSchema.parse(input)
  } catch (err) {
    throw new Error(toFriendlyMessage(err))
  }

  const adminClient = createServiceRoleClient()
  const origin = (await headers()).get('origin')

  // 1. Invita al usuario. Esto crea la fila en auth.users de inmediato
  //    (no solo al aceptar el correo) — el trigger handle_new_user crea
  //    su profile en el mismo instante, con is_active = false.
  //    redirectTo apunta a nuestro propio callback (el mismo que usa
  //    Google OAuth) para reutilizar el intercambio de código, y de ahí
  //    sigue a la pantalla donde define su contraseña.
  const { data: invited, error: inviteError } =
    await adminClient.auth.admin.inviteUserByEmail(data.ownerEmail, {
      data: { role: 'RESTAURANT', full_name: data.ownerFullName },
      redirectTo: `${origin}/api/auth/callback?next=/establecer-contrasena`,
    })

  if (inviteError || !invited.user) {
    throw new Error(`No se pudo invitar: ${inviteError?.message ?? 'error desconocido'}`)
  }

  const { data: ownerProfile, error: profileError } = await adminClient
    .from('profiles')
    .select('id')
    .eq('auth_id', invited.user.id)
    .single()

  if (profileError || !ownerProfile) {
    throw new Error('El perfil del dueño no se creó correctamente. Revisa el trigger handle_new_user.')
  }

  // 2. Crea el restaurante, todavía sin aprobar.
  const { data: restaurant, error: restaurantError } = await adminClient
    .from('restaurants')
    .insert({
      name: data.restaurantName,
      slug: data.slug,
      address_text: data.addressText,
      is_approved: false,
      is_active: true,
    })
    .select('id')
    .single()

  if (restaurantError || !restaurant) {
    throw new Error(`No se pudo crear el restaurante: ${restaurantError?.message}`)
  }

  // 3. Vincula al dueño con su restaurante.
  const { error: memberError } = await adminClient
    .from('restaurant_members')
    .insert({ restaurant_id: restaurant.id, user_id: ownerProfile.id })

  if (memberError) {
    throw new Error(`No se pudo vincular al dueño: ${memberError.message}`)
  }

  revalidatePath('/admin/restaurantes')
  return { success: true }
}

export async function approveRestaurant(restaurantId: string) {
  await assertIsAdmin()
  const adminClient = createServiceRoleClient()

  const { error } = await adminClient
    .from('restaurants')
    .update({ is_approved: true })
    .eq('id', restaurantId)

  if (error) throw new Error(error.message)

  // Activa también a todos los miembros de ese restaurante — su cuenta
  // quedó is_active = false desde el momento de la invitación.
  const { data: members } = await adminClient
    .from('restaurant_members')
    .select('user_id')
    .eq('restaurant_id', restaurantId)

  if (members && members.length > 0) {
    await adminClient
      .from('profiles')
      .update({ is_active: true })
      .in('id', members.map((m) => m.user_id))
  }

  revalidatePath('/admin/restaurantes')
  return { success: true }
}

// ----------------------------------------------------------------------------
// REPARTIDORES
// ----------------------------------------------------------------------------
const inviteDeliverySchema = z.object({
  email: z.string().email('Correo inválido'),
  fullName: z.string().min(2, 'Nombre muy corto'),
})

export async function inviteDeliveryPerson(
  input: z.infer<typeof inviteDeliverySchema>
) {
  await assertIsAdmin()

  let data: z.output<typeof inviteDeliverySchema>
  try {
    data = inviteDeliverySchema.parse(input)
  } catch (err) {
    throw new Error(toFriendlyMessage(err))
  }

  const adminClient = createServiceRoleClient()
  const origin = (await headers()).get('origin')
  const { error } = await adminClient.auth.admin.inviteUserByEmail(data.email, {
    data: { role: 'DELIVERY', full_name: data.fullName },
    redirectTo: `${origin}/api/auth/callback?next=/establecer-contrasena`,
  })

  if (error) {
    throw new Error(`No se pudo invitar: ${error.message}`)
  }

  revalidatePath('/admin/repartidores')
  return { success: true }
}

export async function approveDeliveryPerson(profileId: string) {
  await assertIsAdmin()
  const adminClient = createServiceRoleClient()

  const { error } = await adminClient
    .from('profiles')
    .update({ is_active: true })
    .eq('id', profileId)

  if (error) throw new Error(error.message)

  revalidatePath('/admin/repartidores')
  return { success: true }
}