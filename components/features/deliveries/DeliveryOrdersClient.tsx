'use client'

import useSWR from 'swr'
import { createClient } from '@/lib/db/client'
import { OrderStatusBadge } from '@/components/features/orders/OrderStatusBadge'
import { AdvanceStatusButton } from '@/components/features/deliveries/AdvanceStatusButton'
import { DeliveryOrderCard } from '@/components/features/deliveries/DeliveryOrderCard'
import { RetractOfferButton } from '@/components/features/deliveries/RetractOfferButton'
import { EmptyState } from '@/components/ui/empty-state'
import { useRealtimeInvalidate } from '@/lib/hooks/use-realtime-invalidate'
import type { ApiOrder } from '@/types/order'

async function fetchDeliveryOrders(url: string): Promise<{ success: true; data: ApiOrder[] }> {
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
  const { data, error, isLoading, mutate } = useSWR<{ success: true; data: ApiOrder[] }>(
    '/api/v1/orders',
    fetchDeliveryOrders,
    { revalidateOnFocus: true }
  )
  useRealtimeInvalidate(
    { channelName: 'my-deliveries', table: 'orders', event: 'UPDATE' },
    () => mutate()
  )
  // AWAITING_PAYMENT entra acá: la oferta ya enviada es trabajo en curso del
  // repartidor (está "ocupado" hasta que el cliente pague o él se retire), así
  // que tiene que verla y poder gestionarla desde el mismo lugar.
  const orders = (data?.data ?? []).filter((o) =>
    ['AWAITING_PAYMENT', 'ASSIGNED', 'PICKED_UP', 'ON_THE_WAY'].includes(o.status)
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
        <p role="alert" className="mt-6 text-sm text-destructive">
          No se pudieron cargar tus entregas.
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

            // Mientras espera el pago no hay nada que "avanzar": el pedido
            // arranca cuando el CLIENTE confirma. Lo único que puede hacer el
            // repartidor es retirar su oferta, así que esa acción va en el pie
            // de la tarjeta, con el monto que está cobrando a la vista.
            const waitingPayment = order.status === 'AWAITING_PAYMENT'
            const fee = order.deliveries?.delivery_fee ?? null

            return (
              <DeliveryOrderCard
                key={order.id}
                restaurantName={item0?.restaurant_name ?? restaurant?.name ?? 'Restaurante'}
                pickupAddress={restaurant?.address_text}
                itemsSummary={itemsSummary}
                deliveryAddress={order.addresses?.address_text}
                deliveryReference={order.addresses?.reference}
                total={Number(order.total)}
                badge={<OrderStatusBadge status={order.status} />}
                detailHref={`/repartidor/pedidos/${order.id}`}
                action={
                  waitingPayment ? undefined : (
                    <AdvanceStatusButton
                      orderId={order.id}
                      currentStatus={order.status}
                    />
                  )
                }
                footer={
                  waitingPayment ? (
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs text-muted-foreground">
                        {fee !== null
                          ? `Tu envío: S/ ${fee.toFixed(2)} · esperando que el cliente confirme el pago.`
                          : 'Esperando que el cliente confirme el pago del envío.'}
                      </p>
                      <RetractOfferButton orderId={order.id} deliveryFee={fee} />
                    </div>
                  ) : undefined
                }
              />
            )
          })}
        </div>
      )}

      {!error && orders.length === 0 && (
        <EmptyState
          title="No tienes entregas activas"
          description="Ve a Disponibles para ofertar por un pedido."
          className="mt-10"
        />
      )}
    </>
  )
}
