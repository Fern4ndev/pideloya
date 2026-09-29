'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient, createServiceRoleClient } from '@/lib/db/server'
import { isRestaurantOpenNow } from '@/lib/restaurants/is-open'
import { createOrderSchema, type CreateOrderInput } from '@/lib/validations/order'
import { type PaymentMethod } from '@/lib/constants/payment-method'
import { paymentVoucherPath } from '@/lib/constants/payment-voucher'
import { paymentMethodSchema } from '@/lib/validations/payment-method'
import { removeUnconfirmedVoucher } from '@/lib/storage/payment-vouchers'

function toFriendlyMessage(err: unknown): string {
  if (err instanceof z.ZodError) {
    return err.issues.map((issue) => issue.message).join(' ')
  }
  if (err instanceof Error) return err.message
  return 'Algo salió mal'
}

/**
 * Cancela un pedido. El cliente solo puede hacerlo mientras el pago del envío
 * no esté confirmado — PENDING o AWAITING_PAYMENT (RLS
 * "orders_update_own_customer_cancel" lo exige a nivel de base de datos, no
 * solo aquí). El admin puede cancelar en cualquier momento vía su propia
 * policy "orders_all_admin".
 */
export async function cancelOrder(orderId: string) {
  const supabase = await createClient()

  // IMPORTANTE: encadenamos select().single() a propósito. Si RLS
  // bloquea el update (porque el pedido ya no está cancelable, o no es
  // del cliente que llama), Supabase actualiza 0 filas SIN devolver
  // un error — solo .single() lo detecta, al no encontrar ninguna
  // fila para devolver.
  const { data, error } = await supabase
    .from('orders')
    .update({ status: 'CANCELLED' })
    .eq('id', orderId)
    .select('id')
    .single()

  if (error || !data) {
    throw new Error(
      'No se pudo cancelar. Es posible que un repartidor ya haya aceptado este pedido.'
    )
  }

  // Si el pedido estaba en AWAITING_PAYMENT, la oferta de envío queda
  // huérfana. La cancelación ya está hecha y es lo que el cliente pidió, así
  // que la limpieza es best-effort: si falla, queda una fila inerte en
  // `deliveries` (el pedido ya es CANCELLED y nadie la lee), no un error para
  // el usuario.
  const admin = createServiceRoleClient()

  // El comprobante se borra ANTES de la oferta, no por casualidad: la guarda de
  // `removeUnconfirmedVoucher` lee `payment_confirmed_at` de la fila de
  // `deliveries`, y `releaseUnconfirmedOffer` la borra. Al revés, la guarda
  // leería siempre un `null` y dejaría de proteger nada.
  //
  // Cubre el único huérfano que puede quedar en el flujo: el cliente alcanzó a
  // subir su comprobante y la confirmación falló (red, o el repartidor retiró
  // su oferta en ese instante).
  await removeUnconfirmedVoucher(admin, orderId)
  await releaseUnconfirmedOffer(admin, orderId)

  revalidatePath('/cliente/pedidos')
  revalidatePath(`/cliente/pedidos/${orderId}`)
  revalidatePath('/repartidor/disponibles')
  revalidatePath('/repartidor/pedidos')
  return { success: true }
}

/**
 * Borra la oferta de envío sin confirmar de un pedido. Recibe el cliente con
 * service role ya creado (lo comparte con la limpieza del comprobante, que
 * necesita el mismo privilegio) porque el cliente NO tiene (ni debe tener) policy de DELETE
 * sobre `deliveries`: era una tabla en la que solo el repartidor dueño podía
 * escribir su propia fila, y la cancelación es del cliente. En vez de abrir
 * una policy de DELETE para el cliente (que le daría permiso de borrar
 * entregas ajenas si algún día se escribe mal el `using`), se resuelve con una
 * operación privilegiada, puntual y con guarda explícita.
 *
 * El filtro `payment_confirmed_at is null` es la guarda dura: una entrega con
 * el pago ya confirmado es historial de dinero cobrado y no se toca nunca.
 */
async function releaseUnconfirmedOffer(
  admin: ReturnType<typeof createServiceRoleClient>,
  orderId: string
) {
  const { error } = await admin
    .from('deliveries')
    .delete()
    .eq('order_id', orderId)
    .is('payment_confirmed_at', null)

  if (error) {
    console.error('[orders] no se pudo borrar la oferta huérfana:', error.message)
  }
}

/**
 * El cliente elige cómo paga el pedido y con esa elección arranca la entrega.
 * Llama a la función SECURITY DEFINER select_delivery_payment(uuid, text, text)
 * (migración 20261001100100), que hace la transición AWAITING_PAYMENT ->
 * ASSIGNED de forma atómica en dos tablas, escribe el snapshot
 * `orders.delivery_fee` y guarda el método elegido (más la ruta del
 * comprobante, solo con Yape).
 *
 * Es la ÚNICA puerta a ASSIGNED para el cliente, y la elección es DEFINITIVA
 * (D3): cambiarla después obligaría a reabrir el estado del pedido y a
 * coordinar con un repartidor que ya está en camino. La UI lo avisa antes del
 * clic (PAYMENT_METHOD_LOCK_NOTICE).
 *
 * Con YAPE el comprobante es OBLIGATORIO: la función rechaza la llamada si la
 * ruta no es la de este pedido o si el archivo no existe en Storage. Por eso el
 * orden importa y no es negociable — el navegador sube el archivo ANTES de
 * llamar a esta acción (Fase 4). Si se llama primero, el mensaje de error que ve
 * el usuario es el correcto ("Adjunta el comprobante…"), no una confirmación a
 * medias.
 *
 * Con CASH no se sube ni se envía ningún archivo (y la función rechaza la
 * llamada si llega una ruta): no hay transferencia que documentar. El cobro en
 * efectivo se registra recién al entregar (`cash_collected_at`, vía
 * complete_delivery), no acá: el cliente acá solo se COMPROMETE a pagar al
 * recibir.
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
export async function confirmDeliveryPayment(orderId: string, method: PaymentMethod) {
  // El método se valida en el borde: la base y la función lo vuelven a validar,
  // pero acá se gana que un valor inventado no salga siquiera a la red y que el
  // mensaje sea en español y mostrable tal cual.
  const parsed = paymentMethodSchema.safeParse(method)
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? 'Método de pago inválido')
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('select_delivery_payment', {
    p_order_id: orderId,
    p_method: parsed.data,
    // La ruta viaja SOLO con Yape. Con `undefined` la clave no se envía y
    // aplica el DEFAULT null de la función, que es lo que espera el CHECK
    // deliveries_voucher_requires_yape_check.
    p_voucher_path: parsed.data === 'YAPE' ? paymentVoucherPath(orderId) : undefined,
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

export async function createOrder(input: CreateOrderInput) {
  let data: CreateOrderInput
  try {
    data = createOrderSchema.parse(input)
  } catch (err) {
    throw new Error(toFriendlyMessage(err))
  }

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('No autenticado')

  // El snapshot (customer_name/customer_phone) se congela AQUÍ, al crear
  // el pedido: es el nombre del cliente "al momento del pedido", igual
  // que product_name en order_items. Si el cliente se elimina después
  // (customer_id → null), el historial conserva quién hizo el pedido.
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, full_name, phone')
    .eq('auth_id', user.id)
    .single()
  if (!profile) throw new Error('Perfil no encontrado')

  // Trae los productos reales de la base para RECALCULAR el total en
  // servidor. Nunca confiamos en el precio que manda el navegador —
  // pudo haber sido manipulado antes de llegar aquí.
  const productIds = data.items.map((i) => i.productId)
  const { data: products, error: productsError } = await supabase
    .from('products')
    .select('id, name, price, available, restaurant_id, image_url, restaurants(name)')
    .in('id', productIds)

  if (productsError) throw new Error(productsError.message)
  if (!products || products.length !== productIds.length) {
    throw new Error('Alguno de los productos ya no está disponible')
  }
  if (products.some((p) => !p.available)) {
    throw new Error('Alguno de los productos ya no está disponible')
  }

  // Regla del carrito de un solo restaurante por pedido — se valida
  // también en servidor, no solo en el store del cliente.
  const restaurantIds = new Set(products.map((p) => p.restaurant_id))
  if (restaurantIds.size > 1) {
    throw new Error('No puedes pedir de más de un restaurante a la vez')
  }

  // El restaurante debe estar aprobado, activo y atendiendo (is_open + dentro
  // del horario). Este es el "source of truth": la UI solo deshabilita botones.
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

  const total = data.items.reduce((sum, item) => {
    const product = products.find((p) => p.id === item.productId)!
    return sum + Number(product.price) * item.quantity
  }, 0)

  const { data: order, error: orderError } = await supabase
    .from('orders')
    .insert({
      customer_id: profile.id,
      customer_name: profile.full_name,
      customer_phone: profile.phone,
      address_id: data.addressId,
      status: 'PENDING',
      total,
      notes: data.notes || null,
    })
    .select('id')
    .single()

  if (orderError || !order) {
    throw new Error(orderError?.message ?? 'No se pudo crear el pedido')
  }

  const orderItems = data.items.map((item) => {
    const product = products.find((p) => p.id === item.productId)!
    return {
      order_id: order.id,
      product_id: item.productId,
      product_name: product.name,
      image_url: product.image_url,
      restaurant_id: product.restaurant_id,
      restaurant_name:
        (product.restaurants as unknown as { name: string } | { name: string }[] | null) instanceof Array
          ? (product.restaurants as unknown as { name: string }[])[0]?.name ?? null
          : (product.restaurants as unknown as { name: string } | null)?.name ?? null,
      quantity: item.quantity,
      unit_price: product.price,
    }
  })

  const { error: itemsError } = await supabase
    .from('order_items')
    .insert(orderItems)

  if (itemsError) {
    // El pedido quedó creado sin ítems — lo eliminamos para no dejar
    // un registro a medias.
    await supabase.from('orders').delete().eq('id', order.id)
    throw new Error(itemsError.message)
  }

  revalidatePath('/cliente/pedidos')
  return { success: true, orderId: order.id as string }
}