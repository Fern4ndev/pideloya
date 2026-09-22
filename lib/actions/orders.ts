'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/db/server'
import { createOrderSchema, type CreateOrderInput } from '@/lib/validations/order'

function toFriendlyMessage(err: unknown): string {
  if (err instanceof z.ZodError) {
    return err.issues.map((issue) => issue.message).join(' ')
  }
  if (err instanceof Error) return err.message
  return 'Algo salió mal'
}

/**
 * Cancela un pedido. El cliente solo puede hacerlo mientras esté
 * PENDING (RLS "orders_update_own_customer_cancel" lo exige a nivel de
 * base de datos, no solo aquí). El admin puede cancelar en cualquier
 * momento vía su propia policy "orders_all_admin".
 */
export async function cancelOrder(orderId: string) {
  const supabase = await createClient()

  // IMPORTANTE: encadenamos select().single() a propósito. Si RLS
  // bloquea el update (porque el pedido ya no está PENDING, o no es
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

  revalidatePath('/cliente/pedidos')
  revalidatePath(`/cliente/pedidos/${orderId}`)
  return { success: true }
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

  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('auth_id', user.id)
    .single()
  if (!profile) throw new Error('Perfil no encontrado')

  // Trae los productos reales de la base para RECALCULAR el total en
  // servidor. Nunca confiamos en el precio que manda el navegador —
  // pudo haber sido manipulado antes de llegar aquí.
  const productIds = data.items.map((i) => i.productId)
  const { data: products, error: productsError } = await supabase
    .from('products')
    .select('id, name, price, available, restaurant_id, image_url')
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

  const total = data.items.reduce((sum, item) => {
    const product = products.find((p) => p.id === item.productId)!
    return sum + Number(product.price) * item.quantity
  }, 0)

  const { data: order, error: orderError } = await supabase
    .from('orders')
    .insert({
      customer_id: profile.id,
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