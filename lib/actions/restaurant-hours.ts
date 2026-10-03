'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/db/server'
import { revalidatePublicRestaurants } from '@/lib/db/public'
import { getMyRestaurantIdOrNull } from '@/lib/auth/session'

type DayHours = {
  dayOfWeek: number
  openTime: string
  closeTime: string
  isClosed: boolean
}

export async function updateRestaurantHours(hours: DayHours[]) {
  const restaurantId = await getMyRestaurantIdOrNull()
  if (!restaurantId) throw new Error('No administras ningún restaurante todavía')

  const supabase = await createClient()

  // Upsert por la UNIQUE (restaurant_id, day_of_week) en lugar de
  // delete-all + insert: la versión anterior dejaba el negocio SIN horarios
  // si fallaba a mitad (is_open + tabla vacía = "sin atención" para el
  // cliente). El formulario siempre manda los 7 días, así que el upsert
  // cubre exactamente el mismo caso.
  const rows = hours.map((h) => ({
    restaurant_id: restaurantId,
    day_of_week: h.dayOfWeek,
    open_time: h.openTime,
    close_time: h.closeTime,
    is_closed: h.isClosed,
  }))

  const { error } = await supabase
    .from('restaurant_hours')
    .upsert(rows, { onConflict: 'restaurant_id,day_of_week' })

  if (error) throw new Error(error.message)

  revalidatePublicRestaurants()
  revalidatePath('/restaurante/horarios')
  return { success: true }
}
