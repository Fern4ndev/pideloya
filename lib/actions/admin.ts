'use server'

import { revalidatePath } from 'next/cache'
import { createClient, createServiceRoleClient } from '@/lib/db/server'
import { removeRestaurant } from '@/lib/admin/remove-restaurant'

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

  // Sirve para aprobar (pendiente) y reactivar (soft-deadeado):
  // restaura ambos flags y reactiva a los miembros.
  const { error } = await adminClient
    .from('restaurants')
    .update({ is_approved: true, is_active: true })
    .eq('id', restaurantId)

  if (error) throw new Error(error.message)

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
  revalidatePath('/admin')
  return { success: true, message: 'Restaurante activado' }
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
  revalidatePath('/admin')
  return { success: true, message: 'Repartidor activado' }
}

export async function deleteRestaurant(restaurantId: string) {
  await assertIsAdmin()
  const adminClient = createServiceRoleClient()

  // Híbrido compartido con DELETE /api/v1/restaurants/[id]: soft delete
  // si tiene pedidos, hard delete si no (ver lib/admin/remove-restaurant).
  const result = await removeRestaurant(adminClient, restaurantId)

  revalidatePath('/admin/restaurantes')
  revalidatePath('/admin')
  return result
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
  revalidatePath('/admin')
  return { success: true, message: 'Usuario desactivado' }
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
  const { error: deleteError } = await adminClient
    .from('profiles')
    .delete()
    .eq('id', profileId)
  if (deleteError) throw new Error(deleteError.message)

  if (profile.auth_id) {
    const { error: authError } =
      await adminClient.auth.admin.deleteUser(profile.auth_id as string)
    if (authError) throw new Error(authError.message)
  }

  revalidatePath('/admin/usuarios')
  revalidatePath('/admin/repartidores')
  revalidatePath('/admin')
  return { success: true }
}