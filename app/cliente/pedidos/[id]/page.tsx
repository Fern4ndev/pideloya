import { notFound } from 'next/navigation'
import { createClient } from '@/lib/db/server'
import { OrderStatusSection } from '@/components/features/orders/OrderStatusSection'
import {
  DeliveryPaymentCard,
  type DeliveryOffer,
} from '@/components/features/orders/DeliveryPaymentCard'
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
      `id, status, total, delivery_fee, notes, created_at,
       addresses(address_text, reference),
       order_items(quantity, unit_price, product_name, image_url)`
    )
    .eq('id', id)
    .maybeSingle()

  if (!order) {
    notFound()
  }

  // Identidad y QR del repartidor que está esperando el pago. Solo se pide en
  // AWAITING_PAYMENT: es el único momento en que el cliente necesita verlos.
  // La función RPC (SECURITY DEFINER) filtra por current_profile_id(), así que
  // un pedido ajeno devuelve cero filas — el cliente nunca puede usar esto para
  // leer el perfil de un repartidor desde otro pedido.
  let deliveryOffer: DeliveryOffer | null = null
  if (order.status === 'AWAITING_PAYMENT') {
    const { data: offers } = await supabase.rpc('get_delivery_offer_profile', {
      p_order_id: id,
    })
    const offer = offers?.[0]
    // Si la entrega no tiene tarifa (dato imposible en el flujo nuevo) no se
    // muestra la tarjeta: mejor no ofrecer un botón de "confirmar pago" sobre
    // un monto en cero que inventar un S/ 0.00.
    if (offer && offer.delivery_fee != null) {
      deliveryOffer = {
        fullName: offer.full_name,
        avatarUrl: offer.avatar_url,
        yapeQrUrl: offer.yape_qr_url,
        deliveryFee: Number(offer.delivery_fee),
      }
    }
  }

  // `orders.delivery_fee` es un snapshot que se escribe recién cuando el cliente
  // confirma (ver confirm_delivery_payment), así que mientras espera el pago
  // sigue en NULL. La tarifa vigente vive en la oferta: se usa como respaldo
  // para que el total muestre lo que el cliente realmente va a pagar y no un
  // "por confirmar" que contradice a la tarjeta de arriba.
  const deliveryFee =
    order.delivery_fee != null
      ? Number(order.delivery_fee)
      : deliveryOffer?.deliveryFee ?? null

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

      <div className="mt-6 rounded-3xl border border-black/5 bg-white/70 p-5 shadow-client-card backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
        <OrderStatusSection orderId={order.id} initialStatus={order.status} />
      </div>

      {deliveryOffer && (
        <div className="mt-4">
          <DeliveryPaymentCard orderId={order.id} deliveryPerson={deliveryOffer} />
        </div>
      )}

      <div className="mt-8 space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">Productos</h2>
        <div className="space-y-2.5">
          {order.order_items.map((item, index) => (
            <div
              key={index}
              className="flex items-center gap-3 rounded-3xl border border-black/5 bg-white/70 p-3 shadow-client-card backdrop-blur-xl dark:border-white/10 dark:bg-white/5"
            >
              <div className="h-14 w-14 shrink-0 overflow-hidden rounded-2xl bg-muted">
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

        {/* El total es el dato que el cliente probablemente vino a verificar:
            tarjeta con peso propio y el precio en tamaño de dato principal.
            El desglose existe porque comida y envío son dos pagos distintos
            (el segundo va directo al repartidor por Yape): mostrar un único
            monto sumado sin explicarlo es lo que confunde. */}
        <div className="space-y-1.5 rounded-3xl bg-brand-500/5 px-4 py-3.5 shadow-client-card">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>Subtotal</span>
            <span className="tabular-nums">S/ {Number(order.total).toFixed(2)}</span>
          </div>
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>Envío</span>
            <span className="tabular-nums">
              {deliveryFee !== null ? `S/ ${deliveryFee.toFixed(2)}` : 'Por confirmar'}
            </span>
          </div>
          <div className="flex items-center justify-between border-t border-black/5 pt-1.5 dark:border-white/10">
            <span className="text-sm font-medium">Total</span>
            <span className="text-xl font-bold text-brand-700 tabular-nums">
              S/ {(Number(order.total) + (deliveryFee ?? 0)).toFixed(2)}
            </span>
          </div>
          {deliveryFee !== null && (
            <p className="pt-0.5 text-xs text-muted-foreground">
              El envío se paga directo a tu repartidor por Yape.
            </p>
          )}
        </div>
      </div>

      {order.addresses && (
        <div className="mt-6 flex items-start gap-3 rounded-3xl border border-black/5 bg-white/70 p-4 shadow-client-card backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
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
        <div className="mt-4 flex items-start gap-3 rounded-3xl border border-black/5 bg-white/70 p-4 shadow-client-card backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
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