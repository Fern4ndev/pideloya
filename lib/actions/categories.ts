'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/db/server'
import { categorySchema, type CategoryInput } from '@/lib/validations/category'

function toFriendlyMessage(err: unknown): string {
  if (err instanceof z.ZodError) {
    return err.issues.map((issue) => issue.message).join(' ')
  }
  if (err instanceof Error) return err.message
  return 'Algo salió mal'
}

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
  if (!member) throw new Error('No administras ningún restaurante')

  return { supabase, restaurantId: member.restaurant_id }
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

  revalidatePath('/restaurante/categorias')
  revalidatePath('/restaurante/productos')
  return { success: true }
}