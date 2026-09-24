import type { createServiceRoleClient } from '@/lib/db/server'

type AdminClient = ReturnType<typeof createServiceRoleClient>

export type RemoveRestaurantResult = {
  success: true
  softDeleted: boolean
  message: string
}

export async function removeRestaurant(
  client: AdminClient,
  restaurantId: string
): Promise<RemoveRestaurantResult> {
  const { data: hasOrders } = await client
    .from('order_items')
    .select('restaurant_id')
    .eq('restaurant_id', restaurantId)
    .limit(1)
    .maybeSingle()

  const { data: members } = await client
    .from('restaurant_members')
    .select('user_id')
    .eq('restaurant_id', restaurantId)

  const userIds = (members ?? []).map((m) => m.user_id)

  if (hasOrders) {
    const { error } = await client
      .from('restaurants')
      .update({ is_active: false })
      .eq('id', restaurantId)
    if (error) throw new Error(error.message)

    if (userIds.length > 0) {
      const { error: membersError } = await client
        .from('profiles')
        .update({ is_active: false })
        .in('id', userIds)
      if (membersError) throw new Error(membersError.message)
    }

    return {
      success: true,
      softDeleted: true,
      message: 'Restaurante desactivado (conserva pedidos históricos)',
    }
  }

  const { error } = await client
    .from('restaurants')
    .delete()
    .eq('id', restaurantId)
  if (error) throw new Error(error.message)

  if (userIds.length > 0) {
    const { error: membersError } = await client
      .from('profiles')
      .update({ is_active: false })
      .in('id', userIds)
    if (membersError) throw new Error(membersError.message)
  }

  return {
    success: true,
    softDeleted: false,
    message: 'Restaurante eliminado',
  }
}
