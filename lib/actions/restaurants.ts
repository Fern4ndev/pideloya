'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/db/server'
import { revalidatePublicRestaurants } from '@/lib/db/public'
import { getMyRestaurantIdOrNull } from '@/lib/auth/session'
import {
  restaurantSchema,
  type RestaurantInput,
} from '@/lib/validations/restaurant'
import { deleteImageKitFileSafe } from '@/lib/imagekit-server'

/**
 * Resuelve el restaurant_id que administra el usuario actual.
 * Si el usuario es RESTAURANT y es miembro, devuelve el id.
 *
 * La cadena de identidad (getUser + profiles) vive en lib/auth/session.ts
 * con cache() de React: 1 vez por request en vez de 2 consultas por action.
 */
async function getMyRestaurantId() {
  const restaurantId = await getMyRestaurantIdOrNull()
  if (!restaurantId) throw new Error('No administras ningún restaurante todavía')
  const supabase = await createClient()
  return { supabase, restaurantId }
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
    })
    .eq('id', restaurantId)

  if (error) throw new Error(error.message)

  revalidatePublicRestaurants()
  revalidatePath(`/restaurantes/${slug}`)
  revalidatePath('/restaurante')
  return { success: true }
}

/**
 * Abre o cierra el negocio (is_open) desde el header de "Mi negocio".
 * Solo toca la señal que ve el cliente ("Cerrado / No hay atención");
 * NO modifica is_active (visibilidad/aprobación del admin).
 */
export async function setRestaurantOpen(isOpen: boolean) {
  const { supabase, restaurantId } = await getMyRestaurantId()

  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('slug')
    .eq('id', restaurantId)
    .single()

  if (!restaurant) throw new Error('Restaurante no encontrado')

  const { error } = await supabase
    .from('restaurants')
    .update({ is_open: isOpen })
    .eq('id', restaurantId)

  if (error) throw new Error(error.message)

  revalidatePublicRestaurants()
  revalidatePath(`/restaurantes/${restaurant.slug}`)
  revalidatePath(`/cliente/restaurantes/${restaurant.slug}`)
  revalidatePath('/restaurante/negocio')
  revalidatePath('/restaurante')
  revalidatePath('/cliente')
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

  revalidatePublicRestaurants()
  revalidatePath('/restaurante/negocio')
  revalidatePath('/restaurantes')
  return { success: true }
}