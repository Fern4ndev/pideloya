'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/db/server'
import {
  restaurantSchema,
  type RestaurantInput,
} from '@/lib/validations/restaurant'
import { deleteImageKitFileSafe } from '@/lib/imagekit-server'

/**
 * Resuelve el restaurant_id que administra el usuario actual.
 * Si el usuario es RESTAURANT y es miembro, devuelve el id.
 */
async function getMyRestaurantId() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('No autenticado')

  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('auth_id', user.id)
    .single()

  if (!profile) throw new Error('Perfil no encontrado')

  const { data: member } = await supabase
    .from('restaurant_members')
    .select('restaurant_id')
    .eq('user_id', profile.id)
    .single()

  if (!member) throw new Error('No administras ningún restaurante todavía')

  return { supabase, restaurantId: member.restaurant_id as string }
}

export async function updateRestaurant(input: RestaurantInput) {
  const data = restaurantSchema.parse(input)
  const { supabase, restaurantId } = await getMyRestaurantId()

  const { data: existing } = await supabase
    .from('restaurants')
    .select('name, slug')
    .eq('id', restaurantId)
    .single()

  if (!existing) throw new Error('Restaurante no encontrado')

  // Si el nombre cambia, regeneramos el slug para que sigan coincidiendo.
  let slug = existing.slug as string
  if (existing.name !== data.name) {
    const base = data.name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
      .slice(0, 60)

    const { data: collision } = await supabase
      .from('restaurants')
      .select('id')
      .eq('slug', base)
      .neq('id', restaurantId)
      .maybeSingle()

    if (collision) {
      slug = `${base}-${Math.random().toString(36).slice(2, 7)}`
    } else {
      slug = base
    }
  }

  const { error } = await supabase
    .from('restaurants')
    .update({
      name: data.name,
      description: data.description || null,
      address_text: data.addressText,
      whatsapp: data.whatsapp || null,
      food_type: data.foodType,
      slug,
      // Solo lo escribimos si viene en el payload: el estado del negocio
      // lo controla setRestaurantActive desde el header, no este form.
      ...(data.isActive !== undefined ? { is_active: data.isActive } : {}),
    })
    .eq('id', restaurantId)

  if (error) throw new Error(error.message)

  revalidatePath(`/restaurantes/${slug}`)
  revalidatePath(`/public/restaurantes/${slug}`)
  revalidatePath('/restaurante')
  return { success: true }
}

/**
 * Abre o cierra el negocio (is_active) desde el header de "Mi negocio".
 * A diferencia de toggleRestaurantActive (admin), solo toca el estado
 * del restaurante y no desactiva perfiles.
 */
export async function setRestaurantActive(isActive: boolean) {
  const { supabase, restaurantId } = await getMyRestaurantId()

  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('slug')
    .eq('id', restaurantId)
    .single()

  if (!restaurant) throw new Error('Restaurante no encontrado')

  const { error } = await supabase
    .from('restaurants')
    .update({ is_active: isActive })
    .eq('id', restaurantId)

  if (error) throw new Error(error.message)

  revalidatePath(`/restaurantes/${restaurant.slug}`)
  revalidatePath(`/public/restaurantes/${restaurant.slug}`)
  revalidatePath('/restaurante/negocio')
  revalidatePath('/restaurante')
  return { success: true }
}

export async function saveRestaurantLogo(image: { url: string; fileId: string }) {
  const { supabase, restaurantId } = await getMyRestaurantId()

  const { data: current } = await supabase
    .from('restaurants')
    .select('logo_file_id')
    .eq('id', restaurantId)
    .single()

  const { error } = await supabase
    .from('restaurants')
    .update({ logo_url: image.url, logo_file_id: image.fileId })
    .eq('id', restaurantId)

  if (error) throw new Error(error.message)

  await deleteImageKitFileSafe(current?.logo_file_id)

  revalidatePath('/restaurante/negocio')
  revalidatePath('/restaurantes')
  return { success: true }
}