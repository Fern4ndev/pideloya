'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/db/server'
import { ACTIVE_DELIVERY_STATUSES } from '@/lib/admin/delivery-lifecycle'
import { deliveryOfferSchema, type DeliveryOfferInput } from '@/lib/validations/delivery-offer'
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
  // a la vez (ACTIVE_DELIVERY_STATUSES incluye las ofertas esperando pago).
  // RLS "orders_select_delivery" ya filtra este SELECT a pedidos PENDING o
  // asignados a MÍ — como excluimos PENDING acá, cualquier fila que vuelva
  // es necesariamente mía.
  const { data: activeDeliveries } = await supabase
    .from('orders')
    .select('id')
    .in('status', [...ACTIVE_DELIVERY_STATUSES])
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
  revalidatePath('/cliente/pedidos')
  revalidatePath(`/cliente/pedidos/${orderId}`)
  return { success: true }
}

/**
 * Envía la oferta de envío de un pedido PENDING: el repartidor propone una
 * tarifa (S/ 1 a S/ 30) y el pedido pasa a AWAITING_PAYMENT. El cliente verá
 * su foto, su QR de Yape y esta tarifa para confirmar el pago.
 *
 * Toda la lógica vive en la función SQL offer_delivery() (migración
 * 20260928100300): inserta la entrega y cambia el estado del pedido en una
 * sola transacción, valida rol/cuenta activa, y serializa la regla "una sola
 * oferta o entrega activa" bloqueando la fila del repartidor. Acá solo se
 * valida la tarifa (el borde del sistema) y se traduce el error a un mensaje
 * que el toast pueda mostrar.
 */
export async function sendDeliveryOffer(orderId: string, input: DeliveryOfferInput) {
  const parsed = deliveryOfferSchema.safeParse(input)
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? 'Tarifa de envío inválida')
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('offer_delivery', {
    p_order_id: orderId,
    p_delivery_fee: parsed.data.deliveryFee,
  })
  if (error) throw new Error(error.message)

  revalidatePath('/repartidor/disponibles')
  revalidatePath('/repartidor/pedidos')
  revalidatePath('/cliente/pedidos')
  revalidatePath(`/cliente/pedidos/${orderId}`)
  return { success: true }
}

/**
 * Retira una oferta que el cliente todavía no pagó: borra la fila de
 * `deliveries` y devuelve el pedido a PENDING para que otro repartidor pueda
 * ofertar. Atómico, vía retract_delivery_offer() (mismo motivo que arriba).
 *
 * Devuelve `message` porque es el contrato que espera ConfirmDialog para el
 * toast de éxito (si no, mostraría su genérico "Operación completada").
 */
export async function retractDeliveryOffer(orderId: string) {
  const supabase = await createClient()
  const { error } = await supabase.rpc('retract_delivery_offer', {
    p_order_id: orderId,
  })
  if (error) throw new Error(error.message)

  revalidatePath('/repartidor/disponibles')
  revalidatePath('/repartidor/pedidos')
  revalidatePath('/cliente/pedidos')
  revalidatePath(`/cliente/pedidos/${orderId}`)
  return {
    success: true,
    message: 'Oferta retirada. El pedido volverá a estar disponible para otros repartidores.',
  }
}

// PENDING salió del mapa: el salto a ASSIGNED solo lo produce la confirmación
// del pago del envío (confirm_delivery_payment). Era código muerto del flujo
// de aceptación directa que la UI ya no ofrece (nunca se renderiza "avanzar"
// sobre un PENDING) y la vía por la que un ASSIGNED podía quedar sin fila de
// deliveries ni tarifa (Hallazgo 1 de la Fase 8).
const NEXT_STATUS: Partial<
  Record<
    OrderStatus,
    { next: OrderStatus; timestampField: 'accepted_at' | 'picked_up_at' | 'delivered_at' | null }
  >
> = {
  ASSIGNED: { next: 'PICKED_UP', timestampField: 'picked_up_at' },
  PICKED_UP: { next: 'ON_THE_WAY', timestampField: null },
  ON_THE_WAY: { next: 'DELIVERED', timestampField: 'delivered_at' },
  // Desde AWAITING_PAYMENT el pedido NO lo avanza el repartidor: lo desbloquea
  // el cliente al confirmar su pago por Yape (confirm_delivery_payment, RPC en
  // la migración 20260928100200). El repartidor solo puede retirar su oferta.
  // Se mapea a sí mismo (como DELIVERED/CANCELLED) para que la guarda de abajo
  // lo corte en runtime, en vez de permitir un salto a ASSIGNED sin pago
  // confirmado.
  AWAITING_PAYMENT: { next: 'AWAITING_PAYMENT', timestampField: null },
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
  // `next === currentStatus` (DELIVERED, CANCELLED, AWAITING_PAYMENT) significa
  // "este estado no se avanza desde acá": se corta antes del UPDATE en vez de
  // dejar un update sin efecto que igual dispararía revalidaciones. Mismo
  // criterio que la ruta PUT /api/v1/deliveries/[orderId]/advance.
  if (!transition || transition.next === currentStatus) {
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
  revalidatePath('/cliente/pedidos')
  revalidatePath(`/cliente/pedidos/${orderId}`)
  return { success: true }
}