import { notFound } from 'next/navigation'
import { createClient } from '@/lib/db/server'
import { ClientPageContainer } from '@/components/layout/ClientPageContainer'
import { OrderStatusSection } from '@/components/features/orders/OrderStatusSection'
import { OrderStatusAnnouncer } from '@/components/features/orders/OrderStatusAnnouncer'
import { RealtimeRefresh } from '@/components/ui/realtime-refresh'
import { OrderSummaryCard } from '@/components/features/orders/OrderSummaryCard'
import { PaymentVoucherViewer } from '@/components/features/orders/PaymentVoucherViewer'
import {
  DeliveryPaymentCard,
  type DeliveryOffer,
} from '@/components/features/orders/DeliveryPaymentCard'
import { PAYMENT_VOUCHER_BUCKET, VOUCHER_SIGNED_URL_TTL_S } from '@/lib/constants/payment-voucher'
import type { OrderStatus } from '@/lib/constants/order-status'
import { MapPinIcon, StickyNoteIcon } from 'lucide-react'

/**
 * Estados en los que existe una entrega VIVA, es decir en los que tiene sentido
 * pedir la oferta del repartidor: su teléfono mientras el cliente todavía tiene
 * que pagarle, y el comprobante una vez que pagó.
 *
 * Es una copia deliberada del filtro de `get_delivery_offer_details`. Si
 * divergiera, el síntoma sería silencioso (la tarjeta o el comprobante dejan de
 * aparecer, sin error), así que está escrito junto al porqué.
 */
const LIVE_ORDER_STATUSES: OrderStatus[] = [
  'AWAITING_PAYMENT',
  'ASSIGNED',
  'PICKED_UP',
  'ON_THE_WAY',
]

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

  // Identidad, QR y teléfono del repartidor que está esperando el pago. Solo se
  // pide en AWAITING_PAYMENT: es el único momento en que el cliente necesita
  // verlos.
  //
  // La función RPC (SECURITY DEFINER) filtra por current_profile_id() y por
  // estado, así que un pedido ajeno —o un pedido ya cancelado o entregado—
  // devuelve cero filas: el cliente nunca puede usar esto para leer el perfil
  // de un repartidor desde otro pedido ni para contactar a uno con el que la
  // relación ya terminó.
  //
  // La consulta corre en los estados VIVOS (esperando el pago o ya en camino),
  // y de la misma fila salen dos cosas distintas:
  //
  //   - la tarjeta de pago, que solo aplica en AWAITING_PAYMENT;
  //   - la URL firmada del comprobante, que solo aplica una vez que el cliente
  //     YA pagó (payment_voucher_path no es null) y que es de SOLO LECTURA: la
  //     policy de `update` del bucket ya impide reemplazarlo después de
  //     confirmar (Fase 2).
  let deliveryOffer: DeliveryOffer | null = null
  let voucherUrl: string | null = null

  if (LIVE_ORDER_STATUSES.includes(order.status)) {
    const { data: offers } = await supabase.rpc('get_delivery_offer_details', {
      p_order_id: id,
    })
    const offer = offers?.[0]

    if (offer) {
      // Si la entrega no tiene tarifa (dato imposible en el flujo nuevo) no se
      // muestra la tarjeta: mejor no ofrecer un botón de "confirmar pago"
      // sobre un monto en cero que inventar un S/ 0.00.
      if (order.status === 'AWAITING_PAYMENT' && offer.delivery_fee != null) {
        deliveryOffer = {
          fullName: offer.full_name,
          avatarUrl: offer.avatar_url,
          yapeQrUrl: offer.yape_qr_url,
          phone: offer.phone,
          deliveryFee: Number(offer.delivery_fee),
        }
      }

      // Se firma con el cliente DEL USUARIO (no service role): si la RLS de
      // lectura no le corresponde, simplemente no hay URL. Una URL caducada
      // tampoco rompe nada — al recargar se genera una nueva.
      if (offer.payment_voucher_path) {
        const { data: signed } = await supabase.storage
          .from(PAYMENT_VOUCHER_BUCKET)
          .createSignedUrl(offer.payment_voucher_path, VOUCHER_SIGNED_URL_TTL_S)
        voucherUrl = signed?.signedUrl ?? null
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
      {/* Dos componentes que no dibujan nada, montados una sola vez para todo
          el pedido (Fase 1 del plan de realtime): uno le pide al servidor que
          vuelva a renderizar cuando hay algo nuevo, y el otro avisa al cliente
          qué cambió. Antes de esto el único que escuchaba el pedido era el
          timeline, y su estado era privado del componente: el timeline avanzaba
          solo pero la tarjeta de pago no aparecía hasta recargar a mano.

          `debounceMs={150}` y no el 1000 de admin/restaurante: aquí el cliente
          está mirando la pantalla justamente esperando este evento, así que 1 s
          se siente roto; 150 ms se siente instantáneo y aun así agrupa la
          ráfaga de updates que puede emitir un mismo cambio del pedido. */}
      <RealtimeRefresh
        channelName={`customer-order-${order.id}`}
        table="orders"
        event="UPDATE"
        filter={`id=eq.${order.id}`}
        debounceMs={150}
        syncOnSubscribe
        refreshOnFocus
      />
      <OrderStatusAnnouncer status={order.status} />

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
        <OrderStatusSection orderId={order.id} status={order.status} />

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
            voucher={
              voucherUrl ? (
                <div className="flex items-center gap-3">
                  <PaymentVoucherViewer
                    url={voucherUrl}
                    alt="Comprobante de pago por Yape"
                    actionLabel="Ver"
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-medium">Comprobante enviado</p>
                    <p className="text-xs text-muted-foreground">
                      Es tu constancia del pago del envío por Yape.
                    </p>
                  </div>
                </div>
              ) : undefined
            }
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
