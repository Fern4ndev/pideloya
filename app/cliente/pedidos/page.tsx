import Link from 'next/link'
import { createClient } from '@/lib/db/server'
import { OrderStatusBadge } from '@/components/features/orders/OrderStatusBadge'

export default async function OrdersPage() {
  const supabase = await createClient()

  const { data: orders, error } = await supabase
    .from('orders')
    .select('id, status, total, created_at, order_items(quantity, product_name)')
    .order('created_at', { ascending: false })

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Mis pedidos</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        El historial y estado de todo lo que has pedido.
      </p>

      {error && (
        <p className="mt-6 text-sm text-destructive">
          No se pudieron cargar tus pedidos.
        </p>
      )}

      {!error && orders && orders.length > 0 && (
        <div className="mt-6 space-y-3">
          {orders.map((order) => {
            const itemsSummary = order.order_items
              .map((i) => `${i.quantity}x ${i.product_name}`)
              .join(', ')

            return (
              <Link
                key={order.id}
                href={`/cliente/pedidos/${order.id}`}
                className="block rounded-xl border p-4 transition hover:border-foreground/20 hover:shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {itemsSummary}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {new Date(order.created_at).toLocaleDateString('es-PE', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <OrderStatusBadge status={order.status} />
                    <p className="mt-1 text-sm font-semibold">
                      S/ {Number(order.total).toFixed(2)}
                    </p>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}

      {!error && orders && orders.length === 0 && (
        <div className="mt-10 flex flex-col items-center rounded-xl border border-dashed px-6 py-14 text-center">
          <p className="font-medium">Todavía no has hecho ningún pedido</p>
          <p className="mt-1 max-w-xs text-sm text-muted-foreground">
            Ve a un negocio y arma tu primer pedido.
          </p>
        </div>
      )}
    </div>
  )
}