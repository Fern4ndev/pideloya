'use client'

import useSWR from 'swr'
import { createClient } from '@/lib/db/client'
import { DeliveryOrderCard } from '@/components/features/deliveries/DeliveryOrderCard'
import { SendOfferForm } from '@/components/features/deliveries/SendOfferForm'
import { EmptyState } from '@/components/ui/empty-state'
import { useRealtimeInvalidate } from '@/lib/hooks/use-realtime-invalidate'
import { haversineDistanceKm } from '@/lib/geo/distance'
import type { ApiOrder } from '@/types/order'

async function fetchAvailableOrders(url: string): Promise<{ success: true; data: ApiOrder[] }> {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${session?.access_token ?? ''}`,
    },
  })

  if (!res.ok) throw new Error('Error al cargar pedidos')
  return res.json()
}

export function AvailableOrdersClient() {
  const { data, error, isLoading, mutate } = useSWR<{ success: true; data: ApiOrder[] }>(
    '/api/v1/orders',
    fetchAvailableOrders,
    {
      revalidateOnFocus: true,
    }
  )

  useRealtimeInvalidate(
    { channelName: 'available-orders', table: 'orders' },
    () => mutate()
  )

  // Solo PENDING: un pedido en AWAITING_PAYMENT ya tiene un repartidor
  // ofertando (no necesariamente éste), así que no se ofrece en "Disponibles".
  const orders = (data?.data ?? []).filter((o) => o.status === 'PENDING')

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

            // Distancia en línea recta negocio → cliente: es la base de la
            // tarifa sugerida. Sin ella el repartidor decidiría a ciegas con un
            // "5" fijo, sin saber si el viaje son dos cuadras o ocho
            // kilómetros. Si al restaurante le falta ubicación, devuelve `null`
            // y el formulario cae en la tarifa por defecto.
            const distanceKm = haversineDistanceKm(
              {
                latitude: restaurant?.latitude ?? null,
                longitude: restaurant?.longitude ?? null,
              },
              {
                latitude: order.addresses?.latitude ?? null,
                longitude: order.addresses?.longitude ?? null,
              }
            )

            return (
              <DeliveryOrderCard
                key={order.id}
                restaurantName={item0?.restaurant_name ?? restaurant?.name ?? 'Restaurante'}
                pickupAddress={restaurant?.address_text}
                itemsSummary={itemsSummary}
                deliveryAddress={order.addresses?.address_text}
                total={Number(order.total)}
                footer={<SendOfferForm orderId={order.id} distanceKm={distanceKm} />}
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
