import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/db/server'
import { DeliveryOrderCard } from '@/components/features/deliveries/DeliveryOrderCard'
import { OrderStatusBadge } from '@/components/features/orders/OrderStatusBadge'
import { AdvanceStatusButton } from '@/components/features/deliveries/AdvanceStatusButton'
import { PageHeader } from '@/components/layout/PageHeader'
import { PageContainer } from '@/components/layout/PageContainer'
import { PaymentVoucherViewer } from '@/components/features/orders/PaymentVoucherViewer'
import { CourierQrDialogButton } from '@/components/features/deliveries/CourierQrDialog'
import { CopyButton } from '@/components/ui/copy-button'
import { formatPePhone } from '@/lib/format/phone'
import { PAYMENT_VOUCHER_BUCKET, VOUCHER_SIGNED_URL_TTL_S } from '@/lib/constants/payment-voucher'
import {
  amountDueToCourier,
  toPaymentMethod,
  toPaymentTiming,
} from '@/lib/constants/payment-method'
import type { OrderStatus } from '@/types/order'

export default async function DeliveryOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: order, error } = await supabase
    .from('orders')
    .select(
      `id, status, total, notes, created_at,
       addresses ( address_text, reference ),
       order_items ( product_name, quantity, restaurant_name ),
       deliveries ( delivery_person_id, accepted_at, picked_up_at, delivered_at,
                    delivery_fee, payment_confirmed_at, payment_voucher_path,
                    payment_method, payment_timing, collected_at, collected_method )`
    )
    .eq('id', id)
    .maybeSingle()

  if (error || !order) notFound()

  const delivery = Array.isArray(order.deliveries)
    ? order.deliveries[0]
    : order.deliveries
  const address = Array.isArray(order.addresses)
    ? order.addresses[0]
    : order.addresses
  const items = order.order_items ?? []
  const restaurantName = items[0]?.restaurant_name ?? 'Restaurante'
  const itemsSummary =
    items.map((i: { quantity: number; product_name: string | null }) =>
      `${i.quantity}x ${i.product_name ?? 'Producto'}`
    ).join(', ') || ''
  const status = order.status as OrderStatus

  // Método y momento elegidos por el cliente (null en las entregas legacy
  // aceptadas sin oferta) y el monto a cobrar al recibir: comida + envío (D1),
  // igual en TODOS los métodos. Se deriva acá, no se lee de una columna.
  const paymentMethod = toPaymentMethod(delivery?.payment_method)
  const paymentTiming = toPaymentTiming(delivery?.payment_timing)
  const collectAmount = amountDueToCourier(Number(order.total), delivery?.delivery_fee ?? null)
  // "Se paga al recibir": el eje nuevo, o su equivalente legacy (CASH sin
  // timing). Legacy Yape era siempre "por adelantado".
  const paysOnDelivery =
    paymentTiming === 'ON_DELIVERY' || (paymentTiming === null && paymentMethod === 'CASH')
  const collectedAt = delivery?.collected_at ?? null
  const collectedMethod = toPaymentMethod(delivery?.collected_method)

  // El QR y el teléfono del PROPIO repartidor (perfiles_select_own ya lo
  // permite: es su fila, no hace falta RPC). Es lo que le permite mostrar su
  // QR en la puerta para cobrar un Yape al recibir.
  const {
    data: { user },
  } = await supabase.auth.getUser()
  let courierName: string | null = null
  let courierQrUrl: string | null = null
  let courierPhone: string | null = null
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, yape_qr_url, phone')
      .eq('auth_id', user.id)
      .maybeSingle()
    courierName = profile?.full_name ?? null
    courierQrUrl = profile?.yape_qr_url ?? null
    courierPhone = profile?.phone ?? null
  }
  const courierDigits = courierPhone?.replace(/\D/g, '') ?? ''

  // Comprobante de pago que el cliente adjuntó al confirmar. Es la EVIDENCIA de
  // cobro del repartidor, así que se muestra en su propio detalle (no en la
  // lista: firmar una URL por fila sería un costo innecesario).
  //
  // Se firma con SU cliente y no con service role: la policy
  // payment_vouchers_select_parties decide de verdad si este repartidor es
  // parte del pedido. Si no lo fuera, simplemente no hay URL y el bloque no se
  // renderiza — no hay nada que "saltarse".
  let voucherUrl: string | null = null
  if (delivery?.payment_voucher_path) {
    const { data: signed } = await supabase.storage
      .from(PAYMENT_VOUCHER_BUCKET)
      .createSignedUrl(delivery.payment_voucher_path, VOUCHER_SIGNED_URL_TTL_S)
    voucherUrl = signed?.signedUrl ?? null
  }

  return (
    <PageContainer size="md">
      <PageHeader
        title="Detalle de la entrega"
        description="Revisa el pedido y avanza su estado."
      />

      <div className="mt-6">
        <DeliveryOrderCard
          restaurantName={restaurantName}
          itemsSummary={itemsSummary}
          deliveryAddress={address?.address_text ?? null}
          deliveryReference={address?.reference ?? null}
          total={Number(order.total)}
          badge={<OrderStatusBadge status={status} />}
          action={
            <AdvanceStatusButton
              orderId={order.id}
              currentStatus={status}
              paymentMethod={paymentMethod}
              paymentTiming={paymentTiming}
              cashAmount={collectAmount}
              foodAmount={Number(order.total)}
              restaurantName={restaurantName}
            />
          }
        />
      </div>

      {/* Con pago AL RECIBIR el bloque es el dato que el repartidor necesita EN
          LA PUERTA, así que va pegado a la tarjeta del pedido. Muestra el monto
          grande (comida + envío), el QR PROPIO cuando el cliente anunció Yape,
          y el número como respaldo. Con UPFRONT el equivalente es el
          comprobante del cliente, más abajo. */}
      {paysOnDelivery && (
        // El borde es `amber-600` (3.08:1 medido sobre su propio fondo) y no
        // `amber-300`: el fondo `amber-50` sobre la página blanca mide 1.04:1,
        // así que el borde es lo único que delimita este bloque — y una
        // información de dinero no puede depender de un trazo que no se ve.
        <div className="mt-4 rounded-xl border border-amber-600 bg-amber-50 p-4 dark:border-amber-500/60 dark:bg-amber-500/10">
          <p className="text-xs font-medium text-amber-900 dark:text-amber-100">
            Cobro al entregar
          </p>
          {/* Monto grande y tabular: es lo que se contrasta de un vistazo en la
              puerta, y el desglose evita la disputa "¿el envío estaba
              incluido?". */}
          <p className="mt-1 text-3xl font-bold tabular-nums text-amber-900 dark:text-amber-100">
            S/ {collectAmount.toFixed(2)}
          </p>
          <p className="mt-0.5 text-sm text-amber-900 dark:text-amber-100">
            Comida S/ {Number(order.total).toFixed(2)} + Envío S/{' '}
            {(delivery?.delivery_fee != null ? Number(delivery.delivery_fee) : 0).toFixed(2)}
          </p>

          {/* (D4) Lo que el cliente anunció es INFORMACIÓN, no una obligación:
              el repartidor cobra con el medio real y el diálogo de cobro
              registra la diferencia sin fricción. */}
          <p className="mt-1 text-xs font-medium text-amber-900 dark:text-amber-100">
            El cliente indicó: {paymentMethod === 'YAPE' ? 'Yape' : paymentMethod === 'CASH' ? 'efectivo' : 'sin método registrado'}
          </p>

          {/* Antes de cobrar: monto + QR + número. Después de cobrar: la
              constancia. El mismo lugar, el mismo dato, otro momento.

              Región viva: el paso a "Cobrado" lo provoca una acción propia y
              refresca el Server Component; sin `aria-live` el cambio —que es
              justo el dato que decide si puede entregar— no se anunciaría. */}
          {collectedAt ? (
            <p
              role="status"
              aria-live="polite"
              className="mt-2 text-sm font-medium text-emerald-700 dark:text-emerald-400"
            >
              Cobrado el{' '}
              {new Date(collectedAt).toLocaleString('es-PE', {
                day: '2-digit',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit',
              })}
              {collectedMethod ? ` · ${collectedMethod === 'YAPE' ? 'Yape' : 'efectivo'}` : ''}.
            </p>
          ) : (
            <p className="mt-2 text-sm text-amber-900 dark:text-amber-100">
              Cobra antes de entregar. Si algo falla, no marques la entrega:
              comunícalo a soporte.
            </p>
          )}

          {/* QR propio: solo tiene sentido ANTES de cobrar y cuando el cliente
              anunció Yape. El botón "Mostrar mi QR" abre el diálogo a pantalla
              casi completa; sin QR cargado, el aviso es accionable (subirlo al
              perfil) pero no bloquea el cobro. */}
          {!collectedAt && paymentMethod === 'YAPE' && (
            <div className="mt-3 space-y-2">
              {/* El botón se muestra SIEMPRE (con QR o sin él): es el diálogo que
                  el repartidor abre en la puerta, y sin QR adentro está su número.
                  Si tampoco hay número, el diálogo lo dice en vez de prometerlo. */}
              <CourierQrDialogButton
                qrUrl={courierQrUrl}
                fullName={courierName ?? 'Repartidor'}
                phone={courierPhone}
                amount={collectAmount.toFixed(2)}
              />

              {courierDigits ? (
                // Fila de respaldo (Fase 3.2): el número copiable, para pegar en
                // el chat de Yape cuando el cliente no puede escanear. Sin esto,
                // el único número disponible era el del diálogo a pantalla completa.
                <div className="flex items-center justify-between gap-3 rounded-xl border border-amber-600/40 bg-white/60 p-2 dark:bg-white/5">
                  <div className="min-w-0">
                    <p className="text-xs text-amber-900 dark:text-amber-100">
                      Tu número de Yape
                    </p>
                    <p className="select-all text-sm font-semibold tabular-nums tracking-wide">
                      {formatPePhone(courierDigits)}
                    </p>
                  </div>
                  <CopyButton value={courierDigits} label="mi número de Yape" />
                </div>
              ) : null}

              {!courierQrUrl && (
                <p className="text-xs text-amber-900 dark:text-amber-100">
                  Todavía no cargaste tu QR de Yape.{' '}
                  <Link href="/repartidor/perfil" className="font-medium underline">
                    Súbelo en tu perfil
                  </Link>{' '}
                  para mostrarlo en la puerta.
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {order.notes && (
        <div className="mt-4 rounded-xl border p-4 text-sm">
          <p className="mb-1 text-xs font-medium text-muted-foreground">Notas del cliente</p>
          <p>{order.notes}</p>
        </div>
      )}

      <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
        <div className="rounded-xl bg-muted/50 px-3 py-2.5">
          <p className="text-xs text-muted-foreground">Aceptado</p>
          <p className="font-medium tabular-nums">
            {delivery?.accepted_at
              ? new Date(delivery.accepted_at).toLocaleString('es-PE', {
                  day: '2-digit',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : '—'}
          </p>
        </div>
        <div className="rounded-xl bg-muted/50 px-3 py-2.5">
          <p className="text-xs text-muted-foreground">Entregado</p>
          <p className="font-medium tabular-nums">
            {delivery?.delivered_at
              ? new Date(delivery.delivered_at).toLocaleString('es-PE', {
                  day: '2-digit',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : '—'}
          </p>
        </div>
      </div>

      {voucherUrl && (
        <div className="mt-4 rounded-xl border p-4">
          <p className="mb-3 text-xs font-medium text-muted-foreground">
            Comprobante de pago del cliente
          </p>
          {/* El monto va AL LADO de la imagen a propósito: es lo que le permite
              contrastar de un vistazo que el comprobante coincide con lo que
              cobró, sin tener que leer la captura. */}
          <div className="flex flex-wrap items-center gap-3">
            <PaymentVoucherViewer
              url={voucherUrl}
              alt="Comprobante de pago por Yape"
              thumbnailClassName="h-20 w-20"
              actionLabel="Ver en grande"
            />
            <div className="min-w-0 space-y-1">
              <p className="text-sm">
                Cobro del envío:{' '}
                <span className="font-semibold tabular-nums">
                  {delivery?.delivery_fee != null
                    ? `S/ ${Number(delivery.delivery_fee).toFixed(2)}`
                    : '—'}
                </span>
              </p>
              <p className="text-xs text-muted-foreground">
                {delivery?.payment_confirmed_at
                  ? `Confirmado por el cliente el ${new Date(
                      delivery.payment_confirmed_at
                    ).toLocaleString('es-PE', {
                      day: '2-digit',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}.`
                  : 'Confirmado por el cliente.'}
              </p>
            </div>
          </div>
        </div>
      )}
    </PageContainer>
  )
}
