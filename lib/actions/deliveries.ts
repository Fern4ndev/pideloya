'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/db/server'

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

const NEXT_STATUS: Record<string, { next: string; timestampField: string | null }> = {
    ASSIGNED: { next: 'PICKED_UP', timestampField: 'picked_up_at' },
    PICKED_UP: { next: 'ON_THE_WAY', timestampField: null },
    ON_THE_WAY: { next: 'DELIVERED', timestampField: 'delivered_at' },
}


/**
 * Avanza el pedido un paso en el flujo de entrega. Solo permite avanzar
 * en el orden correcto (no se puede "saltar" de ASSIGNED a DELIVERED) —
 * esto es la parte que RLS por sí sola no valida, así que se hace aquí.
 */
export async function advanceOrderStatus(orderId: string, currentStatus: string) {
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
        .update({ status: transition.next as "PENDING" | "ASSIGNED" | "PICKED_UP" | "ON_THE_WAY" | "DELIVERED" | "CANCELLED" })
        .eq('id', orderId)

    if (orderError) throw new Error(orderError.message)

    if (transition.timestampField) {
        const update = transition.timestampField === 'picked_up_at'
            ? { picked_up_at: new Date().toISOString() }
            : { delivered_at: new Date().toISOString() }

        await supabase
            .from('deliveries')
            .update(update)
            .eq('order_id', orderId)
            .eq('delivery_person_id', profileId)
    }

    revalidatePath('/repartidor/pedidos')
    return { success: true }
}