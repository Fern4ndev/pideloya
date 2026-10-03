'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/db/server'
import { revalidatePublicRestaurants } from '@/lib/db/public'
import { getMyRestaurantIdOrNull } from '@/lib/auth/session'
import { productSchema, type ProductInput } from '@/lib/validations/product'
import { deleteImageKitFileSafe } from '@/lib/imagekit-server'

/**
 * Resuelve a qué restaurante pertenece el usuario actual.
 * No hace falta validar el rol aquí: la policy RLS "products_*_owner"
 * ya rechaza cualquier insert/update/delete fuera de restaurant_members,
 * así que esto es solo para saber el restaurant_id al crear.
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

  revalidatePublicRestaurants()
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

  revalidatePublicRestaurants()
  revalidatePath('/restaurante/productos')
  return { success: true }
}

export async function deleteProduct(productId: string) {
  const { supabase } = await getMyRestaurantId()

  const { data: current, error: fetchError } = await supabase
    .from('products')
    .select('image_file_id')
    .eq('id', productId)
    .maybeSingle()

  // Sin este chequeo, un producto que RLS oculta produciría un delete de
  // 0 filas: toast de "Operación completada" sin borrar nada.
  if (fetchError) throw new Error(fetchError.message)
  if (!current) {
    throw new Error('Producto no encontrado o no tienes permiso para eliminarlo')
  }

  const { error, count } = await supabase
    .from('products')
    .delete({ count: 'exact' })
    .eq('id', productId)

  if (error) throw new Error(error.message)
  if (!count) throw new Error('No se pudo eliminar el producto')

  await deleteImageKitFileSafe(current.image_file_id)

  revalidatePublicRestaurants()
  revalidatePath('/restaurante/productos')
  // El producto también se muestra en la carta pública, en el home del
  // cliente y en su página de detalle: si no se revalidan, el producto
  // borrado sigue apareciendo ahí.
  revalidatePath('/restaurantes')
  revalidatePath('/restaurantes', 'layout')
  revalidatePath('/cliente')
  revalidatePath('/cliente', 'layout')
  revalidatePath(`/productos/${productId}`)
  return { success: true }
}