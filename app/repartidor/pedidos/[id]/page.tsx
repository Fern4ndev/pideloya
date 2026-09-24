import { notFound } from 'next/navigation'
import { createClient } from '@/lib/db/server'
import { DeliveryOrderCard } from '@/components/features/deliveries/DeliveryOrderCard'
import { OrderStatusBadge } from '@/components/features/orders/OrderStatusBadge'
import { AdvanceStatusButton } from '@/components/features/deliveries/AdvanceStatusButton'
import { PageHeader } from '@/components/layout/PageHeader'
import { PageContainer } from '@/components/layout/PageContainer'
import type { OrderStatus } from '@/types/order'

export default async function DeliveryOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: order, error } = await supabase
    .from('orders')
    .select(
      `id, status, total, notes, created_at,
       addresses ( address_text, reference ),
       order_items ( product_name, quantity, restaurant_name ),
       deliveries ( delivery_person_id, accepted_at, picked_up_at, delivered_at )`
    )
    .eq('id', id)
    .maybeSingle()

  if (error || !order) notFound()

  const delivery = Array.isArray(order.deliveries)
    ? order.deliveries[0]
    : order.deliveries
  const address = Array.isArray(order.addresses)
    ? order.addresses[0]
    : order.addresses
  const items = order.order_items ?? []
  const restaurantName = items[0]?.restaurant_name ?? 'Restaurante'
  const itemsSummary =
    items.map((i: { quantity: number; product_name: string | null }) =>
      `${i.quantity}x ${i.product_name ?? 'Producto'}`
    ).join(', ') || ''
  const status = order.status as OrderStatus

  return (
    <PageContainer size="md">
      <PageHeader
        title="Detalle de la entrega"
        description="Revisa el pedido y avanza su estado."
      />

      <div className="mt-6">
        <DeliveryOrderCard
          restaurantName={restaurantName}
          itemsSummary={itemsSummary}
          deliveryAddress={address?.address_text ?? null}
          deliveryReference={address?.reference ?? null}
          total={Number(order.total)}
          badge={<OrderStatusBadge status={status} />}
          action={<AdvanceStatusButton orderId={order.id} currentStatus={status} />}
        />
      </div>

      {order.notes && (
        <div className="mt-4 rounded-xl border p-4 text-sm">
          <p className="mb-1 text-xs font-medium text-muted-foreground">Notas del cliente</p>
          <p>{order.notes}</p>
        </div>
      )}

      <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
        <div className="rounded-xl bg-muted/50 px-3 py-2.5">
          <p className="text-xs text-muted-foreground">Aceptado</p>
          <p className="font-medium tabular-nums">
            {delivery?.accepted_at
              ? new Date(delivery.accepted_at).toLocaleString('es-PE', {
                  day: '2-digit',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : '—'}
          </p>
        </div>
        <div className="rounded-xl bg-muted/50 px-3 py-2.5">
          <p className="text-xs text-muted-foreground">Entregado</p>
          <p className="font-medium tabular-nums">
            {delivery?.delivered_at
              ? new Date(delivery.delivered_at).toLocaleString('es-PE', {
                  day: '2-digit',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : '—'}
          </p>
        </div>
      </div>
    </PageContainer>
  )
}
