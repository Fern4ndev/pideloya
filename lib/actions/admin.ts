'use server'

import { revalidatePath } from 'next/cache'
import { createClient, createServiceRoleClient } from '@/lib/db/server'

async function assertIsAdmin() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('No autenticado')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('auth_id', user.id)
    .single()

  if (profile?.role !== 'ADMIN') {
    throw new Error('Solo el administrador puede realizar esta acción')
  }
}

export async function approveRestaurant(restaurantId: string) {
  await assertIsAdmin()
  const adminClient = createServiceRoleClient()

  const { error } = await adminClient
    .from('restaurants')
    .update({ is_approved: true })
    .eq('id', restaurantId)

  if (error) throw new Error(error.message)

  // Activa también a todos los miembros de ese restaurante — su cuenta
  // quedó is_active = false desde el registro público.
  const { data: members } = await adminClient
    .from('restaurant_members')
    .select('user_id')
    .eq('restaurant_id', restaurantId)

  if (members && members.length > 0) {
    await adminClient
      .from('profiles')
      .update({ is_active: true })
      .in('id', members.map((m) => m.user_id))
  }

  revalidatePath('/admin/restaurantes')
  return { success: true }
}

export async function approveDeliveryPerson(profileId: string) {
  await assertIsAdmin()
  const adminClient = createServiceRoleClient()

  const { error } = await adminClient
    .from('profiles')
    .update({ is_active: true })
    .eq('id', profileId)

  if (error) throw new Error(error.message)

  revalidatePath('/admin/repartidores')
  return { success: true }
}

export async function deactivateRestaurant(restaurantId: string) {
  await assertIsAdmin()
  const adminClient = createServiceRoleClient()

  const { error } = await adminClient
    .from('restaurants')
    .update({ is_active: false })
    .eq('id', restaurantId)

  if (error) throw new Error(error.message)

  // Desactiva también a todos los miembros vinculados.
  const { data: members } = await adminClient
    .from('restaurant_members')
    .select('user_id')
    .eq('restaurant_id', restaurantId)

  if (members && members.length > 0) {
    await adminClient
      .from('profiles')
      .update({ is_active: false })
      .in('id', members.map((m) => m.user_id))
  }

  revalidatePath('/admin/restaurantes')
  return { success: true }
}

export async function toggleRestaurantActive(restaurantId: string) {
  await assertIsAdmin()
  const adminClient = createServiceRoleClient()

  // Obtener estado actual
  const { data: restaurant } = await adminClient
    .from('restaurants')
    .select('is_active')
    .eq('id', restaurantId)
    .single()

  if (!restaurant) throw new Error('Restaurante no encontrado')

  const newActiveState = !restaurant.is_active

  const { error } = await adminClient
    .from('restaurants')
    .update({ is_active: newActiveState })
    .eq('id', restaurantId)

  if (error) throw new Error(error.message)

  // Actualizar también los miembros vinculados
  const { data: members } = await adminClient
    .from('restaurant_members')
    .select('user_id')
    .eq('restaurant_id', restaurantId)

  if (members && members.length > 0) {
    await adminClient
      .from('profiles')
      .update({ is_active: newActiveState })
      .in('id', members.map((m) => m.user_id))
  }

  revalidatePath('/admin/restaurantes')
  return { success: true, is_active: newActiveState }
}

export async function deleteRestaurant(restaurantId: string) {
  await assertIsAdmin()
  const adminClient = createServiceRoleClient()

  const { data: members } = await adminClient
    .from('restaurant_members')
    .select('user_id')
    .eq('restaurant_id', restaurantId)

  // Borrar el restaurante primero (los FKs de categorías/productos
  // están definidos con cascada en las migraciones).
  const { error } = await adminClient
    .from('restaurants')
    .delete()
    .eq('id', restaurantId)

  if (error) throw new Error(error.message)

  if (members && members.length > 0) {
    const userIds = members.map((m) => m.user_id)
    await adminClient
      .from('profiles')
      .update({ is_active: false })
      .in('id', userIds)
  }

  revalidatePath('/admin/restaurantes')
  return { success: true }
}

export async function deactivateUser(profileId: string) {
  await assertIsAdmin()
  const adminClient = createServiceRoleClient()

  const { error } = await adminClient
    .from('profiles')
    .update({ is_active: false })
    .eq('id', profileId)

  if (error) throw new Error(error.message)

  revalidatePath('/admin/usuarios')
  revalidatePath('/admin/repartidores')
  return { success: true }
}

export async function toggleDeliveryPersonActive(profileId: string) {
  await assertIsAdmin()
  const adminClient = createServiceRoleClient()

  // Obtener estado actual
  const { data: profile } = await adminClient
    .from('profiles')
    .select('is_active')
    .eq('id', profileId)
    .single()

  if (!profile) throw new Error('Repartidor no encontrado')

  const newActiveState = !profile.is_active

  const { error } = await adminClient
    .from('profiles')
    .update({ is_active: newActiveState })
    .eq('id', profileId)

  if (error) throw new Error(error.message)

  revalidatePath('/admin/repartidores')
  return { success: true, is_active: newActiveState }
}

export async function updateRestaurant(
  restaurantId: string,
  data: { name?: string; food_type?: string; whatsapp?: string; address_text?: string }
) {
  await assertIsAdmin()
  const adminClient = createServiceRoleClient()

  const { error } = await adminClient
    .from('restaurants')
    .update(data)
    .eq('id', restaurantId)

  if (error) throw new Error(error.message)

  revalidatePath('/admin/restaurantes')
  return { success: true }
}

export async function updateDeliveryPerson(
  profileId: string,
  data: { full_name?: string; phone?: string; document_type?: string; document_number?: string; vehicle_type?: string }
) {
  await assertIsAdmin()
  const adminClient = createServiceRoleClient()

  const { error } = await adminClient
    .from('profiles')
    .update(data)
    .eq('id', profileId)

  if (error) throw new Error(error.message)

  revalidatePath('/admin/repartidores')
  return { success: true }
}

export async function deleteUser(profileId: string) {
  await assertIsAdmin()
  const adminClient = createServiceRoleClient()

  const { data: profile } = await adminClient
    .from('profiles')
    .select('auth_id')
    .eq('id', profileId)
    .single()

  if (!profile) throw new Error('Perfil no encontrado')

  // Eliminar el perfil primero; el FK con auth.users es
  // "on delete cascade" (ver migración de profiles).
  await adminClient.from('profiles').delete().eq('id', profileId)

  if (profile.auth_id) {
    const { error: authError } =
      await adminClient.auth.admin.deleteUser(profile.auth_id as string)
    if (authError) throw new Error(authError.message)
  }

  revalidatePath('/admin/usuarios')
  revalidatePath('/admin/repartidores')
  return { success: true }
}