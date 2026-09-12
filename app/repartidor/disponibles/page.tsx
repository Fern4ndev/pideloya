import { createClient } from '@/lib/db/server'
import { AcceptOrderButton } from '@/components/features/deliveries/AcceptOrderButton'
import { DeliveryOrderCard } from '@/components/features/deliveries/DeliveryOrderCard'
import { PageHeader } from '@/components/layout/PageHeader'
import { PageContainer } from '@/components/layout/PageContainer'

export default async function AvailableOrdersPage() {
  const supabase = await createClient()

  const { data: orders, error } = await supabase
    .from('orders')
    .select(
      `id, total, created_at,
       addresses(address_text),
       order_items(quantity, product_name, restaurants(name, address_text))`
    )
    .eq('status', 'PENDING')
    .order('created_at', { ascending: true })

  return (
    <PageContainer size="md">
      <PageHeader
        title="Pedidos disponibles"
        description="Acepta un pedido para empezar a repartirlo."
      />

      {error && (
        <p className="mt-6 text-sm text-destructive">
          No se pudieron cargar los pedidos.
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
                total={Number(order.total)}
                action={<AcceptOrderButton orderId={order.id} />}
              />
            )
          })}
        </div>
      )}

      {!error && orders && orders.length === 0 && (
        <div className="mt-10 flex flex-col items-center rounded-xl border border-dashed px-6 py-14 text-center">
          <p className="font-medium">No hay pedidos disponibles ahora mismo</p>
          <p className="mt-1 max-w-xs text-sm text-muted-foreground">
            Vuelve a revisar en un rato.
          </p>
        </div>
      )}
    </PageContainer>
  )
}