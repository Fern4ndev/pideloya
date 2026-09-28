import { notFound } from 'next/navigation'
import { createClient } from '@/lib/db/server'
import { ClientPageContainer } from '@/components/layout/ClientPageContainer'
import { OrderStatusSection } from '@/components/features/orders/OrderStatusSection'
import { OrderSummaryCard } from '@/components/features/orders/OrderSummaryCard'
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

  // Layout de dos columnas a partir de `md:` con un solo grid y el resumen
  // como hijo plano (Fase 3.5): en móvil el orden visual ES el orden del DOM —
  // Estado → Pago → Resumen → Entrega, con el resumen antes que "Entrega"
  // porque ahí no hay columna fija donde anclarlo — y en desktop las columnas
  // los separan por sí solas, sin hacks de order-*. Los wrappers son `h-fit`
  // para que cada tarjeta mida solo lo suyo dentro de una fila de grid que
  // estira por defecto.
  return (
    <ClientPageContainer size="wide">
      {/* Encabezado sin tarjeta (Fase 3.2): es metadata de contexto, no
          contenido que compita con el estado del pedido. El identificador
          corto (#XXXXXXXX) le da al cliente algo estable para referenciar el
          pedido (ej. con soporte), que antes no existía en la UI. */}
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
          Pedido #{order.id.slice(0, 8)}
        </h1>
        <p className="text-sm text-muted-foreground">
          {new Date(order.created_at).toLocaleDateString('es-PE', {
            day: 'numeric',
            month: 'long',
          })}
          {' · '}
          {new Date(order.created_at).toLocaleTimeString('es-PE', {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </p>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-[1fr_22rem] md:items-stretch md:gap-6">
        <OrderStatusSection orderId={order.id} initialStatus={order.status} />

        {deliveryOffer && (
          <DeliveryPaymentCard orderId={order.id} deliveryPerson={deliveryOffer} />
        )}

        {/* `md:sticky` + `md:top-20` en el wrapper: al ser hijo directo del
            grid (estirado por items-stretch) tiene el alto de toda la columna
            y el sticky tiene recorrido de sobra. `md:top-20` deja aire respecto
            al header sticky (no queda pegado al borde). En móvil es un bloque
            más del flujo, sin anclar. */}
        <div className="h-fit md:sticky md:top-20">
          <OrderSummaryCard
            items={(order.order_items ?? []).map((item) => ({
              productName: item.product_name,
              quantity: item.quantity,
              unitPrice: Number(item.unit_price),
              imageUrl: item.image_url,
            }))}
            subtotal={Number(order.total)}
            deliveryFee={deliveryFee}
          />
        </div>

        {/* Tarjeta "Entrega" (Fase 3.4): una sola tarjeta secundaria con
            dirección y notas — antes eran dos tarjetas casi idénticas. */}
        {(order.addresses || order.notes) && (
          <div className="h-fit rounded-3xl border border-black/5 bg-white/50 p-5 dark:border-white/10 dark:bg-white/[0.03]">
            <h2 className="text-sm font-medium text-muted-foreground">Entrega</h2>
            <div className="mt-3 space-y-3">
              {order.addresses && (
                <div className="flex items-start gap-2.5">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-500/10 text-brand-600">
                    <MapPinIcon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm">{order.addresses.address_text}</p>
                    {order.addresses.reference && (
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {order.addresses.reference}
                      </p>
                    )}
                  </div>
                </div>
              )}
              {order.notes && (
                <div className="flex items-start gap-2.5">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-500/10 text-brand-600">
                    <StickyNoteIcon className="h-4 w-4" />
                  </span>
                  <p className="min-w-0 text-sm text-muted-foreground">{order.notes}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </ClientPageContainer>
  )
}
