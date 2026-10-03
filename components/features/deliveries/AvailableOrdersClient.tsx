'use client'

import useSWR from 'swr'
import { createClient } from '@/lib/db/client'
import { DeliveryOrderCard } from '@/components/features/deliveries/DeliveryOrderCard'
import { SendOfferForm } from '@/components/features/deliveries/SendOfferForm'
import { EmptyState } from '@/components/ui/empty-state'
import { useRealtimeInvalidate } from '@/lib/hooks/use-realtime-invalidate'
import type { ApiOrder } from '@/types/order'

/**
 * Lectura DIRECTA con RLS (Fase 2.4): antes este listado viajaba por
 * GET /api/v1/orders (DELIVERY), que trae pedidos asignados + AWAITING_PAYMENT
 * y filtraba en JS a PENDING — triple trabajo para mostrar solo los
 * disponibles. La policy orders_select_delivery ya limita a PENDING (para
 * cualquier repartidor) + asignados a mí, y order_items_select_delivery
 * (migración 20261003120500) cubre los PENDING, así que la consulta directa
 * con el cliente del navegador aplica exactamente el mismo permiso sin una
 * vuelta por el servidor de Next.
 *
 * `addresses` solo se pide por compatibilidad de tipo: para un PENDING la
 * policy addresses_select_assigned_delivery NO la entrega (llega null), y es
 * correcto — la dirección del cliente se revela cuando alguien acepta.
 */
async function fetchAvailableOrders(): Promise<ApiOrder[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('orders')
    .select(
      '*, order_items(*, restaurants(name, address_text)), addresses(address_text)'
    )
    .eq('status', 'PENDING')
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) throw new Error('Error al cargar pedidos')
  // Cast vía unknown: `addresses` solo se pide con address_text (ver comentario
  // del archivo) y el resto de ApiOrder llega completo desde `*`.
  return (data ?? []) as unknown as ApiOrder[]
}

export function AvailableOrdersClient({
  acceptsPayOnDelivery,
}: {
  /** `profiles.accepts_pay_on_delivery` del repartidor: la página lo lee una vez
   * (Server Component) y lo baja para no repetir la consulta por tarjeta. */
  acceptsPayOnDelivery: boolean
}) {
  const { data, error, isLoading, mutate } = useSWR<ApiOrder[]>(
    'available-orders',
    fetchAvailableOrders,
    {
      // Fase 2 (anti-churn): el realtime de abajo es la señal, no el foco.
      revalidateOnFocus: false,
    }
  )

  useRealtimeInvalidate(
    {
      channelName: 'available-orders',
      table: 'orders',
      event: '*',
      // Solo altas/estado PENDING importan acá; los UPDATE de pedidos asignados
      // a otros repartidores no cambian esta lista.
      filter: 'status=eq.PENDING',
    },
    () => mutate()
  )

  // La consulta ya trae SOLO PENDING (y el realtime solo escucha PENDING).
  const orders = data ?? []

  if (isLoading) {
    return (
      <div className="mt-6 space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-xl bg-muted" />
        ))}
      </div>
    )
  }

  return (
    <>
      {error && (
        <p role="alert" className="mt-6 text-sm text-destructive">
          No se pudieron cargar los pedidos.
        </p>
      )}

      {!error && orders.length > 0 && (
        <div className="mt-6 space-y-3">
          {orders.map((order) => {
            const item0 = order.order_items?.[0]
            const restaurant = item0?.restaurants
            const itemsSummary = order.order_items
              ?.map((i) => `${i.quantity}x ${i.product_name}`)
              .join(', ') ?? ''

            return (
              <DeliveryOrderCard
                key={order.id}
                restaurantName={item0?.restaurant_name ?? restaurant?.name ?? 'Restaurante'}
                pickupAddress={restaurant?.address_text}
                itemsSummary={itemsSummary}
                deliveryAddress={order.addresses?.address_text}
                total={Number(order.total)}
                footer={
                  <div className="space-y-2">
                    {/* La comida como LÍNEA propia, no sumergida en el total.
                        Si el cliente termina pagando al recibir, ESTA es la
                        plata que el repartidor adelanta al recoger — tiene que
                        verla ANTES de ofertar, porque después solo queda
                        retirar. */}
                    <p className="text-xs text-muted-foreground">
                      Comida: S/ {Number(order.total).toFixed(2)}
                      {acceptsPayOnDelivery
                        ? ' · si te pagan al recibir, la adelantas tú'
                        : ' · este pedido solo admite pago por adelantado'}
                    </p>
                    <SendOfferForm orderId={order.id} />
                  </div>
                }
              />
            )
          })}
        </div>
      )}

      {!error && orders.length === 0 && (
        <EmptyState
          title="No hay pedidos disponibles ahora mismo"
          description="Vuelve a revisar en un rato."
          className="mt-10"
        />
      )}
    </>
  )
}
