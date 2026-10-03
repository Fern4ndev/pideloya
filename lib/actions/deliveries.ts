'use server'

import { revalidatePath } from 'next/cache'
import { createClient, createServiceRoleClient } from '@/lib/db/server'
import { ACTIVE_DELIVERY_STATUSES } from '@/lib/admin/delivery-lifecycle'
import { removeUnconfirmedVoucher } from '@/lib/storage/payment-vouchers'
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

  // La oferta ya no existe, así que su comprobante tampoco tiene dueño (si el
  // cliente alcanzó a subirlo y su confirmación falló, quedó huérfano).
  //
  // Va DESPUÉS del RPC y es seguro por una garantía del propio RPC: se niega a
  // retirar una oferta con `payment_confirmed_at` puesto, así que llegar hasta
  // acá ya implica que no hay ningún pago confirmado que proteger. La guarda de
  // `removeUnconfirmedVoucher` lee la fila —que el RPC acaba de borrar— y por
  // eso borra: sin fila no hay pago confirmado posible.
  //
  // Best-effort: si Storage falla, el repartidor ya retiró su oferta (que es lo
  // que pidió) y lo único que queda es un archivo sin referencias.
  await removeUnconfirmedVoucher(createServiceRoleClient(), orderId)

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
    { next: OrderStatus; timestampField: 'accepted_at' | 'picked_up_at' | null }
  >
> = {
  ASSIGNED: { next: 'PICKED_UP', timestampField: 'picked_up_at' },
  PICKED_UP: { next: 'ON_THE_WAY', timestampField: null },
  // ON_THE_WAY no escribe `delivered_at` desde este mapa: ese paso lo ejecuta
  // complete_delivery() (migración 20261003100000), que marca la entrega Y
  // registra la constancia del cobro en la MISMA transacción. Ver la delegación
  // en advanceOrderStatus.
  ON_THE_WAY: { next: 'DELIVERED', timestampField: null },
  // Desde AWAITING_PAYMENT el pedido NO lo avanza el repartidor: lo desbloquea
  // el cliente al ELEGIR cómo paga el envío (select_delivery_payment, migración
  // 20261001100100). El repartidor solo puede retirar su oferta.
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
 *
 * `opts.restaurantPaid` solo aplica al primer paso (ASSIGNED -> PICKED_UP, vía
 * pickup_delivery, migración 20261002100300) y registra la constancia D6 de que
 * el repartidor le pagó la comida al restaurante al recoger.
 *
 * El último paso (ON_THE_WAY -> DELIVERED) se cierra UN TOQUE, sin declarar
 * medio del cobro: complete_delivery() (migración 20261003100000) ya no lo
 * pide y registra `collected_at` como constancia de que se finalizó con cobro.
 * La salida del repartidor cuando no pudo cobrar es la incidencia de pago
 * ("No pude cobrar"), que NO cambia el estado del pedido.
 */
export async function advanceOrderStatus(
  orderId: string,
  currentStatus: OrderStatus,
  opts?: { restaurantPaid?: boolean }
) {
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

  // Último paso (ON_THE_WAY -> DELIVERED): lo hace la función SQL, no un UPDATE
  // suelto desde acá.
  //
  // Antes eran DOS updates independientes (orders.status y
  // deliveries.delivered_at) y el segundo podía fallar en silencio. Con pago en
  // efectivo eso deja de ser cosmético: hay que registrar el COBRO junto con la
  // entrega, y "entregado sin constancia de cobro" es justo el estado que
  // produce el "no me pagaron" de ambos lados.
  //
  // complete_delivery() comprueba por sí sola que el pedido sea de este
  // repartidor (42501 si no lo es) y, con pago al recibir, escribe
  // `collected_at` en la MISMA transacción: "entregado sin constancia de cobro"
  // sigue siendo imposible sin pedirle nada extra al repartidor.
  if (currentStatus === 'ON_THE_WAY') {
    const { error } = await supabase.rpc('complete_delivery', {
      p_order_id: orderId,
    })
    if (error) throw new Error(error.message)

    revalidatePath('/repartidor/pedidos')
    revalidatePath('/cliente/pedidos')
    revalidatePath(`/cliente/pedidos/${orderId}`)
    return { success: true }
  }

  // Primer paso con constancia de la compra al restaurante (D6): pasa por la
  // función SQL y no por el UPDATE directo de abajo porque es la única puerta
  // que escribe `orders.restaurant_paid_at` de forma atómica con el cambio de
  // estado (y su guarda de pertenencia es por fila, como complete_delivery).
  if (currentStatus === 'ASSIGNED') {
    const { error } = await supabase.rpc('pickup_delivery', {
      p_order_id: orderId,
      p_restaurant_paid: opts?.restaurantPaid === true,
    })
    if (error) throw new Error(error.message)

    revalidatePath('/repartidor/pedidos')
    revalidatePath('/repartidor/disponibles')
    revalidatePath('/cliente/pedidos')
    revalidatePath(`/cliente/pedidos/${orderId}`)
    return { success: true }
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