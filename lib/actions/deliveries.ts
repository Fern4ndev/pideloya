'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/db/server'
import type { OrderStatus } from '@/types/order'

async function getMyProfileId(supabase: Awaited<ReturnType<typeof createClient>>) {
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
  return profile.id
}

/**
 * Acepta un pedido PENDING: crea la fila en `deliveries` asignándose a
 * sí mismo y pasa el pedido a ASSIGNED. La restricción UNIQUE en
 * deliveries.order_id es la red de seguridad real ante una condición
 * de carrera (dos repartidores aceptando el mismo pedido a la vez) —
 * la verificación de abajo solo evita un error de base de datos poco
 * claro en el caso común.
 */
export async function acceptOrder(orderId: string) {
  const supabase = await createClient()
  const profileId = await getMyProfileId(supabase)

  // Regla de negocio: un repartidor solo puede tener UNA entrega activa
  // a la vez. RLS "orders_select_delivery" ya filtra este SELECT a
  // pedidos PENDING o asignados a MÍ — como excluimos PENDING acá,
  // cualquier fila que vuelva es necesariamente mía.
  const { data: activeDeliveries } = await supabase
    .from('orders')
    .select('id')
    .in('status', ['ASSIGNED', 'PICKED_UP', 'ON_THE_WAY'])
    .limit(1)

  if (activeDeliveries && activeDeliveries.length > 0) {
    throw new Error(
      'Ya tienes una entrega activa. Complétala antes de aceptar otra.'
    )
  }

  const { data: order } = await supabase
    .from('orders')
    .select('status')
    .eq('id', orderId)
    .single()

  if (!order || order.status !== 'PENDING') {
    throw new Error('Este pedido ya no está disponible')
  }

  const { error: deliveryError } = await supabase.from('deliveries').insert({
    order_id: orderId,
    delivery_person_id: profileId,
    accepted_at: new Date().toISOString(),
  })

  if (deliveryError) {
    throw new Error('Alguien más aceptó este pedido justo antes que tú')
  }

  const { error: orderError } = await supabase
    .from('orders')
    .update({ status: 'ASSIGNED' })
    .eq('id', orderId)

  if (orderError) throw new Error(orderError.message)

  revalidatePath('/repartidor/disponibles')
  revalidatePath('/repartidor/pedidos')
  return { success: true }
}

const NEXT_STATUS: Record<
  OrderStatus,
  { next: OrderStatus; timestampField: 'accepted_at' | 'picked_up_at' | 'delivered_at' | null }
> = {
  ASSIGNED: { next: 'PICKED_UP', timestampField: 'picked_up_at' },
  PICKED_UP: { next: 'ON_THE_WAY', timestampField: null },
  ON_THE_WAY: { next: 'DELIVERED', timestampField: 'delivered_at' },
  PENDING: { next: 'ASSIGNED', timestampField: 'accepted_at' },
  DELIVERED: { next: 'DELIVERED', timestampField: null },
  CANCELLED: { next: 'CANCELLED', timestampField: null },
}

/**
 * Avanza el pedido un paso en el flujo de entrega. Solo permite avanzar
 * en el orden correcto (no se puede "saltar" de ASSIGNED a DELIVERED) —
 * esto es la parte que RLS por sí sola no valida, así que se hace aquí.
 */
export async function advanceOrderStatus(orderId: string, currentStatus: OrderStatus) {
  const supabase = await createClient()
  const profileId = await getMyProfileId(supabase)

  const transition = NEXT_STATUS[currentStatus]
  if (!transition) {
    throw new Error('Este pedido no puede avanzar de estado')
  }

  // RLS "orders_update_delivery_assigned" ya garantiza que solo puede
  // actualizar pedidos que tiene asignados a sí mismo.
  const { error: orderError } = await supabase
    .from('orders')
    .update({ status: transition.next })
    .eq('id', orderId)

  if (orderError) throw new Error(orderError.message)

  if (transition.timestampField === 'picked_up_at') {
    await supabase
      .from('deliveries')
      .update({ picked_up_at: new Date().toISOString() })
      .eq('order_id', orderId)
      .eq('delivery_person_id', profileId)
  } else if (transition.timestampField === 'delivered_at') {
    await supabase
      .from('deliveries')
      .update({ delivered_at: new Date().toISOString() })
      .eq('order_id', orderId)
      .eq('delivery_person_id', profileId)
  } else if (transition.timestampField === 'accepted_at') {
    await supabase
      .from('deliveries')
      .update({ accepted_at: new Date().toISOString() })
      .eq('order_id', orderId)
      .eq('delivery_person_id', profileId)
  }

  revalidatePath('/repartidor/pedidos')
  return { success: true }
}