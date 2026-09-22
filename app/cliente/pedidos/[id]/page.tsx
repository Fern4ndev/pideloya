import { notFound } from 'next/navigation'
import { createClient } from '@/lib/db/server'
import { OrderStatusSection } from '@/components/features/orders/OrderStatusSection'
import { MapPinIcon, StickyNoteIcon } from 'lucide-react'

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: order } = await supabase
    .from('orders')
    .select(
      `id, status, total, notes, created_at,
       addresses(address_text, reference),
       order_items(quantity, unit_price, product_name, image_url)`
    )
    .eq('id', id)
    .maybeSingle()

  if (!order) {
    notFound()
  }

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="text-2xl font-semibold tracking-tight">
        Pedido del{' '}
        {new Date(order.created_at).toLocaleDateString('es-PE', {
          day: 'numeric',
          month: 'long',
        })}
      </h1>
      <p className="mt-1 text-xs text-muted-foreground">
        {new Date(order.created_at).toLocaleTimeString('es-PE', {
          hour: '2-digit',
          minute: '2-digit',
        })}
      </p>

      <div className="mt-6 rounded-3xl border border-black/5 bg-white/70 p-5 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
        <OrderStatusSection orderId={order.id} initialStatus={order.status} />
      </div>

      <div className="mt-8 space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">Productos</h2>
        <div className="space-y-2.5">
          {order.order_items.map((item, index) => (
            <div
              key={index}
              className="flex items-center gap-3 rounded-2xl border border-black/5 bg-white/70 p-3 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-white/5"
            >
              <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-muted">
                {item.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.image_url}
                    alt={item.product_name ?? ''}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-sm font-medium text-muted-foreground">
                    {item.product_name?.charAt(0) ?? '?'}
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{item.product_name}</p>
                <p className="text-xs text-muted-foreground">
                  {item.quantity} x S/ {Number(item.unit_price).toFixed(2)}
                </p>
              </div>
              <span className="shrink-0 text-sm font-semibold">
                S/ {(Number(item.unit_price) * item.quantity).toFixed(2)}
              </span>
            </div>
          ))}
        </div>

        <div className="flex justify-between rounded-2xl bg-brand-500/5 px-4 py-3.5 text-sm font-semibold">
          <span className="font-normal text-muted-foreground">Total</span>
          <span className="text-brand-700">S/ {Number(order.total).toFixed(2)}</span>
        </div>
      </div>

      {order.addresses && (
        <div className="mt-6 flex items-start gap-3 rounded-2xl border border-black/5 bg-white/70 p-4 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-500/10 text-brand-600">
            <MapPinIcon className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-medium">Dirección de entrega</p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {order.addresses.address_text}
            </p>
            {order.addresses.reference && (
              <p className="text-xs text-muted-foreground">
                {order.addresses.reference}
              </p>
            )}
          </div>
        </div>
      )}

      {order.notes && (
        <div className="mt-4 flex items-start gap-3 rounded-2xl border border-black/5 bg-white/70 p-4 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-500/10 text-brand-600">
            <StickyNoteIcon className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-medium">Notas</p>
            <p className="mt-0.5 text-sm text-muted-foreground">{order.notes}</p>
          </div>
        </div>
      )}
    </div>
  )
}