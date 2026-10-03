'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient, createServiceRoleClient } from '@/lib/db/server'
import { isRestaurantOpenNow } from '@/lib/restaurants/is-open'
import { createOrderSchema, type CreateOrderInput } from '@/lib/validations/order'
import { type PaymentTiming } from '@/lib/constants/payment-method'
import { paymentVoucherPath } from '@/lib/constants/payment-voucher'
import { paymentSelectionSchema } from '@/lib/validations/payment-method'
import { removeUnconfirmedVoucher } from '@/lib/storage/payment-vouchers'

function toFriendlyMessage(err: unknown): string {
  if (err instanceof z.ZodError) {
    return err.issues.map((issue) => issue.message).join(' ')
  }
  if (err instanceof Error) return err.message
  return 'Algo salió mal'
}

/**
 * Cancela un pedido. Delega en la RPC SECURITY DEFINER cancel_order(uuid)
 * (migración 20261003120100), que valida en UNA transacción que el pedido sea
 * del cliente que llama, que siga cancelable (PENDING o AWAITING_PAYMENT, el
 * criterio de la antigua policy "orders_update_own_customer_cancel") y borra
 * la oferta sin confirmar. Ya no puede quedar el pedido CANCELLED con la
 * oferta viva, ni fallar a medias entre el update y la limpieza.
 *
 * La policy de UPDATE directa desaparece con la migración contract
 * (20261003121500): esta RPC es la única puerta de cancelación del cliente
 * (el admin sigue por service_role, que no pasa por aquí).
 */
export async function cancelOrder(orderId: string) {
  const supabase = await createClient()

  const { error } = await supabase.rpc('cancel_order', {
    p_order_id: orderId,
  })

  if (error) {
    // 22000: el pedido ya no está cancelable (p. ej., un repartidor ya lo
    // aceptó justo antes). Los demás códigos (42501 pedido ajeno, P0002
    // inexistente) ya viajan con mensajes mostrables desde la función SQL.
    throw new Error(
      error.code === '22000'
        ? 'No se pudo cancelar. Es posible que un repartidor ya haya aceptado este pedido.'
        : error.message
    )
  }

  // El comprobante huérfano (el cliente alcanzó a subirlo y la confirmación
  // falló por red) se limpia best-effort DESPUÉS de la RPC. La fila de
  // `deliveries` ya no existe (la RPC la borró con su guarda
  // `payment_confirmed_at is null`), así que `removeUnconfirmedVoucher` borra
  // el archivo sin riesgo de tocar un pago confirmado: sin fila no hay pago
  // confirmado posible. Un fallo de Storage deja un archivo sin referencias,
  // no un error para el usuario.
  await removeUnconfirmedVoucher(createServiceRoleClient(), orderId)

  revalidatePath('/cliente/pedidos')
  revalidatePath(`/cliente/pedidos/${orderId}`)
  revalidatePath('/repartidor/disponibles')
  revalidatePath('/repartidor/pedidos')
  return { success: true }
}

/**
 * El cliente elige CUÁNDO paga el pedido y con esa elección arranca la entrega.
 * Llama a la función SECURITY DEFINER
 * select_delivery_payment(uuid, text, text, text) (migración 20261003100000),
 * que hace la transición AWAITING_PAYMENT -> ASSIGNED de forma atómica en dos
 * tablas, escribe el snapshot `orders.delivery_fee` y guarda el momento elegido
 * (más la ruta del comprobante, solo con pago por adelantado).
 *
 * Es la ÚNICA puerta a ASSIGNED para el cliente, y la elección es DEFINITIVA
 * (D3): cambiarla después obligaría a reabrir el estado del pedido y a
 * coordinar con un repartidor que ya está en camino. La UI lo avisa antes del
 * clic (PAYMENT_METHOD_LOCK_NOTICE).
 *
 * Con UPFRONT el pago es por Yape y el comprobante es OBLIGATORIO: la función
 * rechaza la llamada si la ruta no es la de este pedido o si el archivo no
 * existe en Storage. Por eso el orden importa y no es negociable — el navegador
 * sube el archivo ANTES de llamar a esta acción (Fase 4). Si se llama primero,
 * el mensaje de error que ve el usuario es el correcto ("Adjunta el
 * comprobante…"), no una confirmación a medias.
 *
 * Con ON_DELIVERY no se sube ni se envía ningún archivo (y la función rechaza
 * la llamada si llega una ruta): en la puerta existe la app de Yape del
 * repartidor o el billete, no una captura previa (D5). Tampoco se elige ni se
 * guarda un método: acá el cliente solo se COMPROMETE a pagar al recibir, y la
 * constancia de que pagó es `collected_at` al finalizar la entrega.
 *
 * El navegador NO elige la ruta: se deriva acá del orderId, y la función SQL la
 * vuelve a validar contra el CHECK de `deliveries` (defensa en profundidad: un
 * cliente que llamara a la RPC directamente tampoco puede apuntar a otro
 * archivo).
 *
 * No hay pasarela de pago integrada: el comprobante es EVIDENCIA para el
 * repartidor, no VERIFICACIÓN bancaria. La función valida por sí sola que el
 * pedido sea suyo, que esté en el estado correcto y que el comprobante exista,
 * así que acá no hay que repetir esas comprobaciones.
 */
export async function confirmDeliveryPayment(orderId: string, timing: PaymentTiming) {
  // El momento se valida en el borde: la base y la función SQL lo vuelven a
  // validar, pero acá se gana que un valor inventado no salga siquiera a la red
  // y que el mensaje sea en español y mostrable tal cual.
  const parsed = paymentSelectionSchema.safeParse({ timing })
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? 'Elección de pago inválida')
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('select_delivery_payment', {
    p_order_id: orderId,
    p_timing: parsed.data.timing,
    // Con pago por adelantado el único método posible es Yape (la función lo
    // exige, CHECK deliveries_timing_method_check): por eso se manda explícito
    // y NO se envía con ON_DELIVERY, donde el método queda NULL por diseño.
    p_method: parsed.data.timing === 'UPFRONT' ? 'YAPE' : undefined,
    // La ruta viaja SOLO con pago por adelantado. Con `undefined` la clave no
    // se envía y aplica el DEFAULT null de la función, que es lo que espera el
    // CHECK deliveries_voucher_requires_upfront_check.
    p_voucher_path:
      parsed.data.timing === 'UPFRONT' ? paymentVoucherPath(orderId) : undefined,
  })
  if (error) throw new Error(error.message)

  revalidatePath('/cliente/pedidos')
  revalidatePath(`/cliente/pedidos/${orderId}`)
  revalidatePath('/repartidor/pedidos')
  return { success: true }
}

/**
 * Estado de atención del restaurante para el carrito: le dice a la UI del
 * cliente si está "cerrado / sin atención" y hay que bloquear el pedido.
 */
export async function getRestaurantCheckoutState(restaurantId: string) {
  const supabase = await createClient()

  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('is_approved, is_active, is_open')
    .eq('id', restaurantId)
    .maybeSingle()

  if (!restaurant || !restaurant.is_approved || !restaurant.is_active) {
    return { isOpenNow: false }
  }

  const { data: hours } = await supabase
    .from('restaurant_hours')
    .select('day_of_week, open_time, close_time, is_closed')
    .eq('restaurant_id', restaurantId)

  return { isOpenNow: isRestaurantOpenNow(restaurant.is_open, hours ?? []) }
}

/**
 * Crea el pedido vía la RPC SECURITY DEFINER create_order(uuid, text, jsonb,
 * uuid) (migración 20261003120700): pedido + ítems en UNA transacción, total
 * SIEMPRE recalculado en servidor, dirección propia validada, un solo
 * restaurante por pedido, tope de 3 pedidos activos y —lo nuevo— IDEMPOTENCIA:
 * `client_request_id` (uuid que genera el navegador al confirmar) hace que un
 * doble clic o un reintento de red devuelva el MISMO pedido en vez de crear
 * dos.
 *
 * La RPC no valida HORARIO (decisión documentada en la migración; portarla a
 * SQL es Fase 5), así que el guard de atención se queda en TypeScript: se
 * deriva del restaurante REAL de los productos pedidos, nunca de un
 * restaurantId que viaje desde el navegador, y conserva el mensaje en español
 * que la UI muestra.
 */
export async function createOrder(input: CreateOrderInput) {
  let data: CreateOrderInput
  try {
    data = createOrderSchema.parse(input)
  } catch (err) {
    throw new Error(toFriendlyMessage(err))
  }

  const supabase = await createClient()

  // Guard de horario. También mantiene los mensajes de productos/restaurante
  // en español ANTES de llegar a la RPC (que rechazaría igual, pero con
  // errores genéricos de base de datos).
  const productIds = data.items.map((i) => i.productId)
  const { data: products, error: productsError } = await supabase
    .from('products')
    .select('restaurant_id')
    .in('id', productIds)

  if (productsError) throw new Error(productsError.message)
  if (!products || products.length !== productIds.length) {
    throw new Error('Alguno de los productos ya no está disponible')
  }

  // Regla del carrito de un solo restaurante por pedido — la RPC la valida
  // también; aquí se corta antes con el mismo mensaje.
  const restaurantIds = new Set(products.map((p) => p.restaurant_id))
  if (restaurantIds.size > 1) {
    throw new Error('No puedes pedir de más de un restaurante a la vez')
  }

  const restaurantId = Array.from(restaurantIds)[0]
  const { data: restaurant, error: restaurantError } = await supabase
    .from('restaurants')
    .select('is_approved, is_active, is_open')
    .eq('id', restaurantId)
    .maybeSingle()

  // Si la fila no aparece o el admin lo desactivó, ya no está disponible
  // (RLS oculta restaurantes no aprobados/inactivos y no llega aquí).
  if (restaurantError || !restaurant || !restaurant.is_approved || !restaurant.is_active) {
    throw new Error('El negocio ya no está disponible')
  }

  const { data: hours } = await supabase
    .from('restaurant_hours')
    .select('day_of_week, open_time, close_time, is_closed')
    .eq('restaurant_id', restaurantId)

  if (!isRestaurantOpenNow(restaurant.is_open, hours ?? [])) {
    throw new Error(
      'El negocio está cerrado en este momento. No se pueden recibir pedidos.'
    )
  }

  const { data: orderId, error } = await supabase.rpc('create_order', {
    p_address_id: data.addressId,
    p_notes: data.notes || null,
    p_items: data.items.map((i) => ({ product_id: i.productId, quantity: i.quantity })),
    p_client_request_id: data.clientRequestId,
  })

  if (error) throw new Error(error.message)
  if (!orderId) throw new Error('No se pudo crear el pedido')

  revalidatePath('/cliente/pedidos')
  return { success: true, orderId: orderId as string }
}