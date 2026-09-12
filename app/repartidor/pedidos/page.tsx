import { createClient } from '@/lib/db/server'
import { OrderStatusBadge } from '@/components/features/orders/OrderStatusBadge'
import { AdvanceStatusButton } from '@/components/features/deliveries/AdvanceStatusButton'
import { DeliveryOrderCard } from '@/components/features/deliveries/DeliveryOrderCard'
import { PageHeader } from '@/components/layout/PageHeader'
import { PageContainer } from '@/components/layout/PageContainer'

export default async function DeliveryOrdersPage() {
  const supabase = await createClient()

  // RLS "orders_select_delivery" ya limita esto a pedidos PENDING
  // (sin asignar) o asignados a MÍ — el filtro de status de abajo
  // excluye los PENDING, así que lo que queda son siempre pedidos
  // que tengo asignados a mí mismo.
  const { data: orders, error } = await supabase
    .from('orders')
    .select(
      `id, status, total, created_at,
       addresses(address_text, reference),
       order_items(quantity, product_name, restaurants(name, address_text))`
    )
    .in('status', ['ASSIGNED', 'PICKED_UP', 'ON_THE_WAY'])
    .order('created_at', { ascending: true })

  return (
    <PageContainer size="md">
      <PageHeader
        title="Mis entregas"
        description="Pedidos que tienes asignados ahora mismo."
      />

      {error && (
        <p className="mt-6 text-sm text-destructive">
          No se pudieron cargar tus entregas.
        </p>
      )}

      {!error && orders && orders.length > 0 && (
        <div className="mt-6 space-y-3">
          {orders.map((order) => {
            const restaurant = order.order_items[0]?.restaurants
            const itemsSummary = order.order_items
              .map((i) => `${i.quantity}x ${i.product_name}`)
              .join(', ')

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

      {!error && orders && orders.length === 0 && (
        <div className="mt-10 flex flex-col items-center rounded-xl border border-dashed px-6 py-14 text-center">
          <p className="font-medium">No tienes entregas activas</p>
          <p className="mt-1 max-w-xs text-sm text-muted-foreground">
            Ve a `Disponibles` para aceptar un pedido.
          </p>
        </div>
      )}
    </PageContainer>
  )
}