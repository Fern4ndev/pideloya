import type { createServiceRoleClient } from '@/lib/db/server'
import { deleteImageKitFileSafe } from '@/lib/imagekit-server'

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
    // Cancelar pedidos PENDING del restaurante ANTES de desactivarlo:
    // si no, quedan "Buscando repartidor" para siempre (nadie los va a
    // aceptar: el negocio ya no existe para el cliente). Un pedido
    // PENDING nunca tiene fila en `deliveries`, así que no hay nada más
    // que limpiar. Los pedidos ya ASSIGNED/PICKED_UP/ON_THE_WAY NO se
    // auto-cancelan (entregas en camino): quedan como caso conocido para
    // revisión manual del admin.
    const { data: pendingItems } = await client
      .from('order_items')
      .select('order_id, orders!inner(status)')
      .eq('restaurant_id', restaurantId)
      .in('orders.status', ['PENDING'])

    const pendingOrderIds = [
      ...new Set((pendingItems ?? []).map((item) => item.order_id)),
    ]

    if (pendingOrderIds.length > 0) {
      const { error: cancelError } = await client
        .from('orders')
        .update({ status: 'CANCELLED' })
        .in('id', pendingOrderIds)
      if (cancelError) throw new Error(cancelError.message)
    }

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
      message:
        pendingOrderIds.length > 0
          ? `Restaurante desactivado (conserva pedidos históricos). Se cancelaron ${pendingOrderIds.length} pedido(s) pendiente(s).`
          : 'Restaurante desactivado (conserva pedidos históricos)',
    }
  }

  // Hard delete: sin order_items no puede existir ningún pedido de este
  // restaurante, así que no hay pedidos que cancelar aquí.
  //
  // Limpieza de ImageKit (Fase 4 del plan): el cascade ON DELETE purga
  // filas de products/categories, pero NUNCA toca ImageKit — sin esto,
  // el logo y las imágenes de productos quedan huérfanos en la cuenta de
  // ImageKit para siempre (fuga de almacenamiento/costos).
  //
  // Se recolectan los fileIds ANTES del delete: el cascade borra las
  // filas y los fileIds se perderían. Se borra ANTES de .delete() de
  // restaurants: si el borrado de BD falla, a lo sumo borramos imágenes
  // de un restaurante que sigue existiendo (solo pasa si nadie lo edita
  // nunca más); al revés, un fallo posterior dejaría filas borradas con
  // imágenes huérfanas irrecuperables (no sabemos qué fileId borrar).
  // deleteImageKitFileSafe es "best effort": nunca lanza.
  const [{ data: restaurant }, { data: products }] = await Promise.all([
    client
      .from('restaurants')
      .select('logo_file_id')
      .eq('id', restaurantId)
      .maybeSingle(),
    client
      .from('products')
      .select('image_file_id')
      .eq('restaurant_id', restaurantId),
  ])

  const fileIds = [
    restaurant?.logo_file_id,
    ...(products ?? []).map((p) => p.image_file_id),
  ].filter((id): id is string => !!id)

  await Promise.all(fileIds.map((id) => deleteImageKitFileSafe(id)))

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
