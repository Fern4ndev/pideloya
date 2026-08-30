import { createClient } from '@/lib/db/server'
import { OrderStatusBadge } from '@/components/features/orders/OrderStatusBadge'
import { AdvanceStatusButton } from '@/components/features/deliveries/AdvanceStatusButton'

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
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Mis entregas</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Pedidos que tienes asignados ahora mismo.
      </p>

      {error && (
        <p className="mt-6 text-sm text-destructive">
          No se pudieron cargar tus entregas.
        </p>
      )}

      {!error && orders && orders.length > 0 && (
        <div className="mt-6 space-y-3">
          {orders.map((order) => {
            const restaurant = order.order_items[0]?.restaurants
            return (
              <div key={order.id} className="rounded-xl border p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      {restaurant?.name ?? 'Restaurante'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Recoger en: {restaurant?.address_text}
                    </p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Entregar en: {order.addresses?.address_text}
                    </p>
                    {order.addresses?.reference && (
                      <p className="text-xs text-muted-foreground">
                        {order.addresses.reference}
                      </p>
                    )}
                  </div>
                  <OrderStatusBadge status={order.status} />
                </div>
                <div className="mt-3 flex items-center justify-between border-t pt-3">
                  <span className="text-sm font-semibold">
                    S/ {Number(order.total).toFixed(2)}
                  </span>
                  <AdvanceStatusButton
                    orderId={order.id}
                    currentStatus={order.status}
                  />
                </div>
              </div>
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
    </div>
  )
}