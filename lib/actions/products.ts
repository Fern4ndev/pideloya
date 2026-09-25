'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/db/server'
import { productSchema, type ProductInput } from '@/lib/validations/product'
import { deleteImageKitFileSafe } from '@/lib/imagekit-server'

/**
 * Resuelve a qué restaurante pertenece el usuario actual.
 * No hace falta validar el rol aquí: la policy RLS "products_*_owner"
 * ya rechaza cualquier insert/update/delete fuera de restaurant_members,
 * así que esto es solo para saber el restaurant_id al crear.
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

  return { supabase, restaurantId: member.restaurant_id }
}

export async function createProduct(input: ProductInput) {
  const data = productSchema.parse(input)
  const { supabase, restaurantId } = await getMyRestaurantId()

  const { error } = await supabase.from('products').insert({
    restaurant_id: restaurantId,
    name: data.name,
    description: data.description || null,
    price: data.price,
    image_url: data.imageUrl || null,
    image_file_id: data.imageFileId || null,
    available: data.available,
    category_id: data.categoryId || null,
  })

  if (error) throw new Error(error.message)

  revalidatePath('/restaurante/productos')
  return { success: true }
}

export async function updateProduct(productId: string, input: ProductInput) {
  const data = productSchema.parse(input)
  const { supabase } = await getMyRestaurantId()

  const { data: current } = await supabase
    .from('products')
    .select('image_file_id')
    .eq('id', productId)
    .single()

  // No filtramos por restaurant_id a mano — la policy RLS
  // "products_update_owner" ya garantiza que solo puede tocar
  // productos de SU PROPIO restaurante.
  const { error } = await supabase
    .from('products')
    .update({
      name: data.name,
      description: data.description || null,
      price: data.price,
      image_url: data.imageUrl || null,
      image_file_id: data.imageFileId || null,
      available: data.available,
      category_id: data.categoryId || null,
    })
    .eq('id', productId)

  if (error) throw new Error(error.message)

  // Si se reemplazó la imagen, borra la anterior de ImageKit.
  if (current?.image_file_id && current.image_file_id !== data.imageFileId) {
    await deleteImageKitFileSafe(current.image_file_id)
  }

  revalidatePath('/restaurante/productos')
  return { success: true }
}

export async function deleteProduct(productId: string) {
  const { supabase } = await getMyRestaurantId()

  const { data: current } = await supabase
    .from('products')
    .select('image_file_id')
    .eq('id', productId)
    .single()

  const { error } = await supabase.from('products').delete().eq('id', productId)

  if (error) throw new Error(error.message)

  await deleteImageKitFileSafe(current?.image_file_id)

  revalidatePath('/restaurante/productos')
  return { success: true }
}