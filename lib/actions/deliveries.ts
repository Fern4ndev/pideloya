'use server'

import { revalidatePath } from 'next/cache'
import { createClient, createServiceRoleClient } from '@/lib/db/server'
import { removeUnconfirmedVoucher } from '@/lib/storage/payment-vouchers'
import { deliveryOfferSchema, type DeliveryOfferInput } from '@/lib/validations/delivery-offer'
import type { OrderStatus } from '@/types/order'

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

  // Paso intermedio PICKED_UP → ON_THE_WAY: start_route() (migración
  // 20261003120100), SECURITY DEFINER. Antes era un UPDATE directo sobre
  // `orders` (la policy orders_update_delivery_assigned lo autorizaba); la
  // migración contract (20261003121500) revoca UPDATE en orders para
  // `authenticated`, y esta RPC es la puerta de reemplazo: valida por dentro
  // que el pedido esté asignado a quien llama (42501 si no) y que esté en
  // PICKED_UP (22000 si no), en una sola transacción.
  if (currentStatus === 'PICKED_UP') {
    const { error } = await supabase.rpc('start_route', {
      p_order_id: orderId,
    })
    if (error) throw new Error(error.message)

    revalidatePath('/repartidor/pedidos')
    revalidatePath('/cliente/pedidos')
    revalidatePath(`/cliente/pedidos/${orderId}`)
    return { success: true }
  }

  // PENDING, AWAITING_PAYMENT, DELIVERED y CANCELLED no se avanzan desde acá:
  // el salto a ASSIGNED solo lo produce la confirmación del pago del cliente
  // (select_delivery_payment) y los estados finales son definitivos. Mismo
  // criterio que la ruta PUT /api/v1/orders/[id]/advance.
  throw new Error('Este pedido no puede avanzar de estado')
}