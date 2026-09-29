import { notFound } from 'next/navigation'
import { createClient } from '@/lib/db/server'
import { DeliveryOrderCard } from '@/components/features/deliveries/DeliveryOrderCard'
import { OrderStatusBadge } from '@/components/features/orders/OrderStatusBadge'
import { AdvanceStatusButton } from '@/components/features/deliveries/AdvanceStatusButton'
import { PageHeader } from '@/components/layout/PageHeader'
import { PageContainer } from '@/components/layout/PageContainer'
import { PaymentVoucherViewer } from '@/components/features/orders/PaymentVoucherViewer'
import { PAYMENT_VOUCHER_BUCKET, VOUCHER_SIGNED_URL_TTL_S } from '@/lib/constants/payment-voucher'
import { cashAmountDue, toPaymentMethod } from '@/lib/constants/payment-method'
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
                    payment_method, cash_collected_at )`
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

  // Método elegido por el cliente (null en las entregas legacy aceptadas sin
  // oferta) y, si es efectivo, el monto que debe cobrar en la puerta: comida +
  // envío (D1). Se deriva acá, no se lee de una columna.
  const paymentMethod = toPaymentMethod(delivery?.payment_method)
  const cashAmount = cashAmountDue(Number(order.total), delivery?.delivery_fee ?? null)

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
              cashAmount={cashAmount}
            />
          }
        />
      </div>

      {/* Con EFECTIVO el bloque es el dato que el repartidor necesita EN LA
          PUERTA, así que va pegado a la tarjeta del pedido y no al final.
          Es secundario (no una tarjeta más con el mismo peso visual): la
          tarjeta de arriba ya dice qué pedido es y a dónde va; esto solo
          agrega el monto exacto a cobrar. Con Yape el equivalente es el
          comprobante, más abajo. */}
      {paymentMethod === 'CASH' && (
        // El borde es `amber-600` (3.08:1 medido sobre su propio fondo) y no
        // `amber-300`: el fondo `amber-50` sobre la página blanca mide 1.04:1,
        // así que el borde es lo único que delimita este bloque — y una
        // información de dinero no puede depender de un trazo que no se ve.
        <div className="mt-4 rounded-xl border border-amber-600 bg-amber-50 p-4 dark:border-amber-500/60 dark:bg-amber-500/10">
          <p className="text-xs font-medium text-amber-900 dark:text-amber-100">
            Cobro en efectivo
          </p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-amber-900 dark:text-amber-100">
            S/ {cashAmount.toFixed(2)}
          </p>
          {/* Antes de entregar el texto es una instrucción ("cobra al
              entregar"); después, la constancia de que el cobro quedó
              registrado. El mismo lugar, el mismo dato, dos momentos. */}
          <p className="mt-0.5 text-sm text-amber-900 dark:text-amber-100">
            {delivery?.cash_collected_at
              ? `Cobrado el ${new Date(delivery.cash_collected_at).toLocaleString('es-PE', {
                  day: '2-digit',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                })}.`
              : 'Cobra al entregar: comida + envío.'}
          </p>
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
