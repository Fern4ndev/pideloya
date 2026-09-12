'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/db/server'

type DayHours = {
  dayOfWeek: number
  openTime: string
  closeTime: string
  isClosed: boolean
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

  if (!member) throw new Error('No administras ningún restaurante todavía')

  return { supabase, restaurantId: member.restaurant_id as string }
}

export async function getRestaurantHours() {
  const { supabase, restaurantId } = await getMyRestaurantId()

  const { data, error } = await supabase
    .from('restaurant_hours')
    .select('day_of_week, open_time, close_time, is_closed')
    .eq('restaurant_id', restaurantId)
    .order('day_of_week')

  if (error) throw new Error(error.message)
  return data
}

export async function updateRestaurantHours(hours: DayHours[]) {
  const { supabase, restaurantId } = await getMyRestaurantId()

  // Eliminar horarios existentes
  const { error: deleteError } = await supabase
    .from('restaurant_hours')
    .delete()
    .eq('restaurant_id', restaurantId)

  if (deleteError) throw new Error(deleteError.message)

  // Insertar nuevos horarios
  const rows = hours.map((h) => ({
    restaurant_id: restaurantId,
    day_of_week: h.dayOfWeek,
    open_time: h.openTime,
    close_time: h.closeTime,
    is_closed: h.isClosed,
  }))

  const { error: insertError } = await supabase
    .from('restaurant_hours')
    .insert(rows)

  if (insertError) throw new Error(insertError.message)

  revalidatePath('/restaurante/horarios')
  return { success: true }
}
