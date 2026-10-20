'use server'

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { z } from 'zod'
import { createServiceRoleClient } from '@/lib/db/server'
import {
  enforceRegistrationRateLimit,
  getClientIp,
  verifyTurnstileToken,
} from '@/lib/security/registration-guard'
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
 *
 * El ROL viaja en app_metadata (C3): handle_new_user lo lee de
 * raw_app_meta_data (migración 20261003120200). app_metadata NO es
 * editable por el usuario (ni con su JWT, ni desde el dashboard
 * público), a diferencia de user_metadata — que un usuario autenticado
 * podía reescribir con updateUser({ user_metadata: { role: 'ADMIN' } }).
 */
export async function registerRestaurant(input: RestaurantRegistrationInput) {
  let data: RestaurantRegistrationInput
  try {
    data = restaurantRegistrationSchema.parse(input)
  } catch (err) {
    throw new Error(toFriendlyMessage(err))
  }

  const ip = getClientIp(await headers())
  await enforceRegistrationRateLimit(ip)
  await verifyTurnstileToken(data.turnstileToken)

  const adminClient = createServiceRoleClient()

  // Cuenta ya confirmada, sin correo de por medio.
  const { data: created, error: createError } =
    await adminClient.auth.admin.createUser({
      email: data.ownerEmail,
      password: data.password,
      email_confirm: true,
      // Rol en app_metadata (no editable por el usuario); lo personal va
      // en user_metadata.
      app_metadata: { role: 'RESTAURANT' },
      user_metadata: { full_name: data.ownerFullName },
    })

  if (createError || !created.user) {
    if (createError?.message.includes('already been registered')) {
      throw new Error('Ya existe una cuenta con ese correo.')
    }
    throw new Error(
      `No se pudo crear la cuenta: ${createError?.message ?? 'error desconocido'}`
    )
  }

  // COMPENSACIÓN (C4): si algo falla DESPUÉS de crear el usuario de Auth,
  // se borra la cuenta — sin esto queda una cuenta huérfana con perfil a
  // medias que ni el visitante (no llegó a "crearla") ni el admin
  // (no está en ninguna lista) pueden ver.
  try {
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
  } catch (err) {
    // El perfil/trigger se borra en cascada con la cuenta (handle_new_user
    // + ON DELETE CASCADE). Logueamos el error ORIGINAL para diagnóstico y
    // el mensaje que ve el usuario es el mismo de siempre.
    console.error('[registration] compensación: borrando cuenta huérfana:', err)
    await adminClient.auth.admin.deleteUser(created.user.id)
    throw err instanceof Error ? err : new Error('No se pudo completar el registro')
  }

  revalidatePath('/admin/restaurantes')
  return { success: true }
}

/**
 * Registro público de repartidor. Mismo criterio: cuenta creada de
 * inmediato pero is_active=false hasta que el admin lo apruebe. Rate limit
 * + Turnstile + compensación como registerRestaurant, y el rol en
 * app_metadata (C3, ver comentario arriba).
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

  const ip = getClientIp(await headers())
  await enforceRegistrationRateLimit(ip)
  await verifyTurnstileToken(data.turnstileToken)

  const adminClient = createServiceRoleClient()

  const { data: created, error } = await adminClient.auth.admin.createUser({
    email: data.email,
    password: data.password,
    email_confirm: true,
    app_metadata: { role: 'DELIVERY' },
    user_metadata: { full_name: data.fullName },
  })

  if (error || !created.user) {
    if (error?.message.includes('already been registered')) {
      throw new Error('Ya existe una cuenta con ese correo.')
    }
    throw new Error(`No se pudo crear la cuenta: ${error?.message ?? 'error desconocido'}`)
  }

  try {
    const { error: profileUpdateError } = await adminClient
      .from('profiles')
      .update({
        phone: data.phone,
        document_type: data.documentType,
        document_number: data.documentNumber,
        vehicle_type: data.vehicleType,
      })
      .eq('auth_id', created.user.id)

    if (profileUpdateError) {
      throw new Error(`No se pudo completar el perfil: ${profileUpdateError.message}`)
    }
  } catch (err) {
    console.error('[registration] compensación: borrando cuenta huérfana:', err)
    await adminClient.auth.admin.deleteUser(created.user.id)
    throw err instanceof Error ? err : new Error('No se pudo completar el registro')
  }

  revalidatePath('/admin/repartidores')
  return { success: true }
}