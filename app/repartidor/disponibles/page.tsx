import { createClient } from '@/lib/db/server'
import { AcceptOrderButton } from '@/components/features/deliveries/AcceptOrderButton'

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
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">
        Pedidos disponibles
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Acepta un pedido para empezar a repartirlo.
      </p>

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
              <div key={order.id} className="rounded-xl border p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      {restaurant?.name ?? 'Restaurante'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Recoger en: {restaurant?.address_text}
                    </p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {itemsSummary}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Entregar en: {order.addresses?.address_text}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-semibold">
                      S/ {Number(order.total).toFixed(2)}
                    </p>
                    <AcceptOrderButton orderId={order.id} />
                  </div>
                </div>
              </div>
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
    </div>
  )
}