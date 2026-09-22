'use client'

import useSWR from 'swr'
import { createClient } from '@/lib/db/client'
import { OrderStatusBadge } from '@/components/features/orders/OrderStatusBadge'
import { AdvanceStatusButton } from '@/components/features/deliveries/AdvanceStatusButton'
import { DeliveryOrderCard } from '@/components/features/deliveries/DeliveryOrderCard'
import { useRealtimeInvalidate } from '@/lib/hooks/use-realtime-invalidate'

async function fetchDeliveryOrders(url: string) {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${session?.access_token ?? ''}`,
    },
  })

  if (!res.ok) throw new Error('Error al cargar entregas')
  return res.json()
}

export function DeliveryOrdersClient() {
  const { data, error, isLoading, mutate } = useSWR('/api/v1/orders', fetchDeliveryOrders, {
    revalidateOnFocus: true,
  })
  useRealtimeInvalidate(
    { channelName: 'my-deliveries', table: 'orders', event: 'UPDATE' },
    () => mutate()
  )
  const orders = (data?.data ?? []).filter((o: any) =>
    ['ASSIGNED', 'PICKED_UP', 'ON_THE_WAY'].includes(o.status)
  )

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
          No se pudieron cargar tus entregas.
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
                deliveryReference={order.addresses?.reference}
                total={Number(order.total)}
                badge={<OrderStatusBadge status={order.status} />}
                action={
                  <AdvanceStatusButton
                    orderId={order.id}
                    currentStatus={order.status}
                  />
                }
              />
            )
          })}
        </div>
      )}

      {!error && orders.length === 0 && (
        <div className="mt-10 flex flex-col items-center rounded-xl border border-dashed px-6 py-14 text-center">
          <p className="font-medium">No tienes entregas activas</p>
          <p className="mt-1 max-w-xs text-sm text-muted-foreground">
            Ve a Disponibles para aceptar un pedido.
          </p>
        </div>
      )}
    </>
  )
}
