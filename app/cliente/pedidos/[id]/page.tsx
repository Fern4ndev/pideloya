import { notFound } from 'next/navigation'
import { createClient } from '@/lib/db/server'
import { OrderStatusSection } from '@/components/features/orders/OrderStatusSection'

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
       order_items(quantity, unit_price, product_name)`
    )
    .eq('id', id)
    .maybeSingle()

  if (!order) {
    notFound()
  }

  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-semibold tracking-tight">
        Pedido del{' '}
        {new Date(order.created_at).toLocaleDateString('es-PE', {
          day: 'numeric',
          month: 'long',
        })}
      </h1>

      <div className="mt-6">
        <OrderStatusSection orderId={order.id} initialStatus={order.status} />
      </div>

      <div className="mt-8 space-y-2 border-t pt-4">
        <h2 className="text-sm font-medium">Productos</h2>
        {order.order_items.map((item, index) => (
          <div key={index} className="flex justify-between text-sm">
            <span className="text-muted-foreground">
              {item.quantity}x {item.product_name}
            </span>
            <span>
              S/ {(Number(item.unit_price) * item.quantity).toFixed(2)}
            </span>
          </div>
        ))}
        <div className="flex justify-between border-t pt-2 text-sm font-semibold">
          <span>Total</span>
          <span>S/ {Number(order.total).toFixed(2)}</span>
        </div>
      </div>

      {order.addresses && (
        <div className="mt-8 border-t pt-4">
          <h2 className="text-sm font-medium">Dirección de entrega</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {order.addresses.address_text}
          </p>
          {order.addresses.reference && (
            <p className="text-xs text-muted-foreground">
              {order.addresses.reference}
            </p>
          )}
        </div>
      )}

      {order.notes && (
        <div className="mt-8 border-t pt-4">
          <h2 className="text-sm font-medium">Notas</h2>
          <p className="mt-1 text-sm text-muted-foreground">{order.notes}</p>
        </div>
      )}
    </div>
  )
}