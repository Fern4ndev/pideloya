import type { createServiceRoleClient } from '@/lib/db/server'

type AdminClient = ReturnType<typeof createServiceRoleClient>

export type ActiveDelivery = {
  id: string
  order_id: string
}

// Estados en los que el pedido sigue "vivo" para el repartidor.
// Fuera de ellos (DELIVERED/CANCELLED) la entrega es solo historial.
export const ACTIVE_DELIVERY_STATUSES = [
  'ASSIGNED',
  'PICKED_UP',
  'ON_THE_WAY',
] as const

/**
 * Devuelve la primera entrega activa del repartidor, o null si no tiene
 * ninguna. Mismo patrón de query que el route accept
 * (app/api/v1/deliveries/[orderId]/accept): join orders!inner + filtro de
 * status, ya validado en el proyecto.
 *
 * ¿Por qué existe? deactivateUser() debe BLOQUEAR la desactivación de un
 * repartidor con entrega en curso: si no, el pedido queda colgado en
 * tracking eterno para el cliente y, con delivery_person_id = null
 * (migración 20260923100000), invisible para otros repartidores.
 */
export async function getActiveDelivery(
  client: AdminClient,
  deliveryPersonId: string
): Promise<ActiveDelivery | null> {
  const { data } = await client
    .from('deliveries')
    .select('id, order_id, orders!inner(status)')
    .eq('delivery_person_id', deliveryPersonId)
    .in('orders.status', [...ACTIVE_DELIVERY_STATUSES])
    .limit(1)
    .maybeSingle()

  return data ? { id: data.id, order_id: data.order_id } : null
}

/**
 * Liberación defensiva: devuelve al pool (status PENDING) todos los
 * pedidos activos del repartidor y borra sus filas en `deliveries`.
 * Devuelve cuántos pedidos se liberaron.
 *
 * ¿Por qué existe? deleteUser() es irreversible: con ON DELETE SET NULL
 * (20260923100000) un pedido activo quedaría huérfano sin persona
 * asignada para siempre. Devolverlo a PENDING lo hace visible de nuevo
 * en /repartidor/disponibles para otro repartidor. También cubre pedidos
 * colgados legacy de desactivaciones anteriores a la guarda de
 * deactivateUser().
 *
 * Orden de operaciones (importante): primero se borra la fila de
 * `deliveries` y después se devuelve el pedido a PENDING. Si se hiciera
 * al revés, otro repartidor podría aceptar el pedido entre ambas
 * operaciones y chocar con la restricción UNIQUE(order_id) de deliveries.
 */
export async function releaseActiveDeliveries(
  client: AdminClient,
  deliveryPersonId: string
): Promise<number> {
  const { data: activeDeliveries } = await client
    .from('deliveries')
    .select('id, order_id, orders!inner(status)')
    .eq('delivery_person_id', deliveryPersonId)
    .in('orders.status', [...ACTIVE_DELIVERY_STATUSES])

  const rows = activeDeliveries ?? []
  if (rows.length === 0) return 0

  const { error: deleteError } = await client
    .from('deliveries')
    .delete()
    .in(
      'id',
      rows.map((row) => row.id)
    )
  if (deleteError) throw new Error(deleteError.message)

  const { error: ordersError } = await client
    .from('orders')
    .update({ status: 'PENDING' })
    .in(
      'id',
      rows.map((row) => row.order_id)
    )
  if (ordersError) throw new Error(ordersError.message)

  return rows.length
}
