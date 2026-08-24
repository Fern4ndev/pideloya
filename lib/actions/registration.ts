'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createServiceRoleClient } from '@/lib/db/server'
import {
  restaurantRegistrationSchema,
  deliveryRegistrationSchema,
  type RestaurantRegistrationInput,
  type DeliveryRegistrationInput,
} from '@/lib/validations/registration'

function toFriendlyMessage(err: unknown): string {
  if (err instanceof z.ZodError) {
    return err.issues.map((issue) => issue.message).join(' ')
  }
  if (err instanceof Error) return err.message
  return 'Algo salió mal'
}

function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

/**
 * Registro público de restaurante (sin sesión previa — lo llena
 * cualquier visitante desde la home). Usa el service role porque
 * quien llama todavía no tiene cuenta ni permisos: es nuestro propio
 * código de servidor el que decide qué insertar, no el visitante.
 *
 * Queda pendiente de aprobación (is_approved=false, profile
 * is_active=false) hasta que el admin lo revise en /admin/restaurantes.
 */
export async function registerRestaurant(input: RestaurantRegistrationInput) {
  let data: RestaurantRegistrationInput
  try {
    data = restaurantRegistrationSchema.parse(input)
  } catch (err) {
    throw new Error(toFriendlyMessage(err))
  }

  const adminClient = createServiceRoleClient()

  // Cuenta ya confirmada, sin correo de por medio.
  const { data: created, error: createError } =
    await adminClient.auth.admin.createUser({
      email: data.ownerEmail,
      password: data.password,
      email_confirm: true,
      user_metadata: { role: 'RESTAURANT', full_name: data.ownerFullName },
    })

  if (createError || !created.user) {
    if (createError?.message.includes('already been registered')) {
      throw new Error('Ya existe una cuenta con ese correo.')
    }
    throw new Error(
      `No se pudo crear la cuenta: ${createError?.message ?? 'error desconocido'}`
    )
  }

  const { data: ownerProfile, error: profileError } = await adminClient
    .from('profiles')
    .select('id')
    .eq('auth_id', created.user.id)
    .single()

  if (profileError || !ownerProfile) {
    throw new Error('El perfil no se creó correctamente.')
  }

  await adminClient
    .from('profiles')
    .update({ phone: data.ownerPhone })
    .eq('id', ownerProfile.id)

  // Slug único: si "pollos-doña-rosa" ya existe, prueba con -2, -3…
  const baseSlug = slugify(data.restaurantName)
  let slug = baseSlug
  for (let attempt = 1; attempt <= 5; attempt++) {
    const { data: existing } = await adminClient
      .from('restaurants')
      .select('id')
      .eq('slug', slug)
      .maybeSingle()
    if (!existing) break
    slug = `${baseSlug}-${attempt + 1}`
  }

  const { data: restaurant, error: restaurantError } = await adminClient
    .from('restaurants')
    .insert({
      name: data.restaurantName,
      slug,
      address_text: data.addressText,
      whatsapp: data.whatsapp,
      food_type: data.foodType,
      is_approved: false,
      is_active: true,
    })
    .select('id')
    .single()

  if (restaurantError || !restaurant) {
    throw new Error(
      `No se pudo registrar el restaurante: ${restaurantError?.message}`
    )
  }

  const { error: memberError } = await adminClient
    .from('restaurant_members')
    .insert({ restaurant_id: restaurant.id, user_id: ownerProfile.id })

  if (memberError) {
    throw new Error(`No se pudo vincular la cuenta: ${memberError.message}`)
  }

  revalidatePath('/admin/restaurantes')
  return { success: true }
}

/**
 * Registro público de repartidor. Mismo criterio: cuenta creada de
 * inmediato pero is_active=false hasta que el admin lo apruebe.
 */
export async function registerDeliveryPerson(
  input: DeliveryRegistrationInput
) {
  let data: DeliveryRegistrationInput
  try {
    data = deliveryRegistrationSchema.parse(input)
  } catch (err) {
    throw new Error(toFriendlyMessage(err))
  }

  const adminClient = createServiceRoleClient()

  const { data: created, error } = await adminClient.auth.admin.createUser({
    email: data.email,
    password: data.password,
    email_confirm: true,
    user_metadata: { role: 'DELIVERY', full_name: data.fullName },
  })

  if (error || !created.user) {
    if (error?.message.includes('already been registered')) {
      throw new Error('Ya existe una cuenta con ese correo.')
    }
    throw new Error(`No se pudo crear la cuenta: ${error?.message ?? 'error desconocido'}`)
  }

  await adminClient
    .from('profiles')
    .update({
      phone: data.phone,
      document_type: data.documentType,
      document_number: data.documentNumber,
      vehicle_type: data.vehicleType,
    })
    .eq('auth_id', created.user.id)

  revalidatePath('/admin/repartidores')
  return { success: true }
}