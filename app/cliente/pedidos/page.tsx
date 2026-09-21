import Link from 'next/link'
import { createClient } from '@/lib/db/server'
import { OrderStatusBadge } from '@/components/features/orders/OrderStatusBadge'
import { ChevronRightIcon, ReceiptIcon, SearchIcon } from 'lucide-react'

export default async function OrdersPage() {
  const supabase = await createClient()

  const { data: orders, error } = await supabase
    .from('orders')
    .select('id, status, total, created_at, order_items(quantity, product_name)')
    .order('created_at', { ascending: false })

  const pendingCount = orders?.filter((o) => o.status === 'PENDING').length ?? 0

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Mis pedidos</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        El historial y estado de todo lo que has pedido.
      </p>

      {pendingCount > 0 && (
        <div className="mt-4 flex items-center gap-3 rounded-2xl border border-amber-200/60 bg-amber-50/80 px-4 py-3 backdrop-blur-sm">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-600">
            <SearchIcon className="h-4 w-4" />
          </span>
          <div>
            <p className="text-sm font-medium text-amber-800">
              {pendingCount} {pendingCount === 1 ? 'pedido buscando' : 'pedidos buscando'} repartidor
            </p>
            <p className="text-xs text-amber-600">
              Te avisaremos cuando alguien lo acepte
            </p>
          </div>
        </div>
      )}

      {error && (
        <p className="mt-6 rounded-2xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
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
                className="group block rounded-3xl border border-black/5 bg-white/70 p-4 shadow-sm backdrop-blur-xl transition-all hover:-translate-y-0.5 hover:shadow-md dark:border-white/10 dark:bg-white/5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 gap-3">
                    <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-brand-500/10 text-brand-600">
                      <ReceiptIcon className="h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{itemsSummary}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {new Date(order.created_at).toLocaleDateString('es-PE', {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <div className="text-right">
                      <OrderStatusBadge status={order.status} />
                      <p className="mt-1 text-sm font-semibold">
                        S/ {Number(order.total).toFixed(2)}
                      </p>
                    </div>
                    <ChevronRightIcon className="h-4 w-4 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5" />
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}

      {!error && orders && orders.length === 0 && (
        <div className="mt-10 flex flex-col items-center rounded-3xl border border-dashed border-black/10 bg-black/[0.02] px-6 py-14 text-center dark:border-white/10 dark:bg-white/[0.02]">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-400 to-brand-600 text-white">
            <ReceiptIcon className="h-6 w-6" />
          </span>
          <p className="mt-4 font-medium">Todavía no has hecho ningún pedido</p>
          <p className="mt-1 max-w-xs text-sm text-muted-foreground">
            Ve a un negocio y arma tu primer pedido.
          </p>
        </div>
      )}
    </div>
  )
}