'use client'

import useSWR from 'swr'
import { createClient } from '@/lib/db/client'
import { AcceptOrderButton } from '@/components/features/deliveries/AcceptOrderButton'
import { DeliveryOrderCard } from '@/components/features/deliveries/DeliveryOrderCard'

async function fetchAvailableOrders(url: string) {
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
  const { data, error, isLoading } = useSWR(
    '/api/v1/orders',
    fetchAvailableOrders,
    {
      refreshInterval: 5000,
      revalidateOnFocus: true,
      dedupingInterval: 2000,
    }
  )

  const orders = (data?.data ?? []).filter((o: any) => o.status === 'PENDING')

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
        <p className="mt-6 text-sm text-destructive">
          No se pudieron cargar los pedidos.
        </p>
      )}

      {!error && orders.length > 0 && (
        <div className="mt-6 space-y-3">
          {orders.map((order: any) => {
            const restaurant = order.order_items?.[0]?.restaurants
            const itemsSummary = order.order_items
              ?.map((i: any) => `${i.quantity}x ${i.product_name}`)
              .join(', ') ?? ''

            return (
              <DeliveryOrderCard
                key={order.id}
                restaurantName={restaurant?.name ?? 'Restaurante'}
                pickupAddress={restaurant?.address_text}
                itemsSummary={itemsSummary}
                deliveryAddress={order.addresses?.address_text}
                total={Number(order.total)}
                action={<AcceptOrderButton orderId={order.id} />}
              />
            )
          })}
        </div>
      )}

      {!error && orders.length === 0 && (
        <div className="mt-10 flex flex-col items-center rounded-xl border border-dashed px-6 py-14 text-center">
          <p className="font-medium">No hay pedidos disponibles ahora mismo</p>
          <p className="mt-1 max-w-xs text-sm text-muted-foreground">
            Vuelve a revisar en un rato.
          </p>
        </div>
      )}
    </>
  )
}
