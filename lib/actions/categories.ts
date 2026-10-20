'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/db/server'
import { revalidatePublicRestaurants } from '@/lib/db/public'
import { getMyRestaurantIdOrNull } from '@/lib/auth/session'
import { categorySchema, type CategoryInput } from '@/lib/validations/category'

function toFriendlyMessage(err: unknown): string {
  if (err instanceof z.ZodError) {
    return err.issues.map((issue) => issue.message).join(' ')
  }
  if (err instanceof Error) return err.message
  return 'Algo salió mal'
}

// La cadena de identidad (getUser + profiles) vive en lib/auth/session.ts
// con cache() de React: 1 vez por request en vez de 2 consultas por action.
async function getMyRestaurantId() {
  const restaurantId = await getMyRestaurantIdOrNull()
  if (!restaurantId) throw new Error('No administras ningún restaurante')
  const supabase = await createClient()
  return { supabase, restaurantId }
}

export async function createCategory(input: CategoryInput) {
  let data: CategoryInput
  try {
    data = categorySchema.parse(input)
  } catch (err) {
    throw new Error(toFriendlyMessage(err))
  }

  const { supabase, restaurantId } = await getMyRestaurantId()

  const { error } = await supabase.from('categories').insert({
    restaurant_id: restaurantId,
    name: data.name,
  })

  if (error) throw new Error(error.message)

  revalidatePublicRestaurants()
  revalidatePath('/restaurante/categorias')
  return { success: true }
}

export async function updateCategory(categoryId: string, input: CategoryInput) {
  let data: CategoryInput
  try {
    data = categorySchema.parse(input)
  } catch (err) {
    throw new Error(toFriendlyMessage(err))
  }

  const { supabase } = await getMyRestaurantId()

  const { error } = await supabase
    .from('categories')
    .update({ name: data.name })
    .eq('id', categoryId)

  if (error) throw new Error(error.message)

  revalidatePublicRestaurants()
  revalidatePath('/restaurante/categorias')
  return { success: true }
}

export async function deleteCategory(categoryId: string) {
  const { supabase } = await getMyRestaurantId()

  // Los productos que usaban esta categoría quedan sin categoría
  // (category_id → null) — no se borran. El FK ya está definido con
  // "on delete set null" en la tabla products desde la migración 0001.
  const { error } = await supabase
    .from('categories')
    .delete()
    .eq('id', categoryId)

  if (error) throw new Error(error.message)

  revalidatePublicRestaurants()
  revalidatePath('/restaurante/categorias')
  revalidatePath('/restaurante/productos')
  return { success: true }
}