'use client'

import useSWR from 'swr'
import Link from 'next/link'
import { BanknoteIcon, CheckCircle2Icon, PaperclipIcon, SmartphoneIcon } from 'lucide-react'
import { createClient } from '@/lib/db/client'
import { OrderStatusBadge } from '@/components/features/orders/OrderStatusBadge'
import { AdvanceStatusButton } from '@/components/features/deliveries/AdvanceStatusButton'
import { DeliveryOrderCard } from '@/components/features/deliveries/DeliveryOrderCard'
import { RetractOfferButton } from '@/components/features/deliveries/RetractOfferButton'
import { EmptyState } from '@/components/ui/empty-state'
import { useRealtimeInvalidate } from '@/lib/hooks/use-realtime-invalidate'
import { amountDueToCourier, toPaymentMethod, toPaymentTiming } from '@/lib/constants/payment-method'
import type { ApiOrder } from '@/types/order'

async function fetchDeliveryOrders(url: string): Promise<{ success: true; data: ApiOrder[] }> {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${session?.access_token ?? ''}`,
    },
  })

  if (!res.ok) throw new Error('Error al cargar entregas')
  return res.json()
}

export function DeliveryOrdersClient() {
  const { data, error, isLoading, mutate } = useSWR<{ success: true; data: ApiOrder[] }>(
    '/api/v1/orders',
    fetchDeliveryOrders,
    { revalidateOnFocus: true }
  )
  useRealtimeInvalidate(
    { channelName: 'my-deliveries', table: 'orders', event: 'UPDATE' },
    () => mutate()
  )
  // AWAITING_PAYMENT entra acá: la oferta ya enviada es trabajo en curso del
  // repartidor (está "ocupado" hasta que el cliente pague o él se retire), así
  // que tiene que verla y poder gestionarla desde el mismo lugar.
  const orders = (data?.data ?? []).filter((o) =>
    ['AWAITING_PAYMENT', 'ASSIGNED', 'PICKED_UP', 'ON_THE_WAY'].includes(o.status)
  )

  if (isLoading) {
    return (
      <div className="mt-6 space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-xl bg-muted" />
        ))}
      </div>
    )
  }

  return (
    <>
      {error && (
        <p role="alert" className="mt-6 text-sm text-destructive">
          No se pudieron cargar tus entregas.
        </p>
      )}

      {!error && orders.length > 0 && (
        <div className="mt-6 space-y-3">
          {orders.map((order) => {
            const item0 = order.order_items?.[0]
            const restaurant = item0?.restaurants
            const itemsSummary = order.order_items
              ?.map((i) => `${i.quantity}x ${i.product_name}`)
              .join(', ') ?? ''

            // Mientras espera el pago no hay nada que "avanzar": el pedido
            // arranca cuando el CLIENTE confirma. Lo único que puede hacer el
            // repartidor es retirar su oferta, así que esa acción va en el pie
            // de la tarjeta, con el monto que está cobrando a la vista.
            const waitingPayment = order.status === 'AWAITING_PAYMENT'
            const fee = order.deliveries?.delivery_fee ?? null
            // Método y timing llegan con el `deliveries(*)` que ya traía esta
            // consulta; `toPaymentMethod`/`toPaymentTiming` los estrechan a los
            // valores del dominio para que un valor inesperado caiga en el estado
            // neutro en vez de romper el pie. Legacy sin timing: el único método
            // que existía era efectivo.
            const paymentMethod = toPaymentMethod(order.deliveries?.payment_method)
            const paymentTiming = toPaymentTiming(order.deliveries?.payment_timing)
            const paysOnDelivery =
              paymentTiming === 'ON_DELIVERY' || (paymentTiming === null && paymentMethod === 'CASH')
            const due = amountDueToCourier(Number(order.total), fee)
            const collectedAt = order.deliveries?.collected_at ?? null
            const collectedMethod = toPaymentMethod(order.deliveries?.collected_method)

            return (
              <DeliveryOrderCard
                key={order.id}
                restaurantName={item0?.restaurant_name ?? restaurant?.name ?? 'Restaurante'}
                pickupAddress={restaurant?.address_text}
                itemsSummary={itemsSummary}
                deliveryAddress={order.addresses?.address_text}
                deliveryReference={order.addresses?.reference}
                total={Number(order.total)}
                badge={<OrderStatusBadge status={order.status} />}
                detailHref={`/repartidor/pedidos/${order.id}`}
                action={
                  waitingPayment ? undefined : (
                    <AdvanceStatusButton
                      orderId={order.id}
                      currentStatus={order.status}
                      paymentMethod={paymentMethod}
                      paymentTiming={paymentTiming}
                      cashAmount={due}
                      foodAmount={Number(order.total)}
                      restaurantName={item0?.restaurant_name ?? restaurant?.name ?? 'el restaurante'}
                    />
                  )
                }
                footer={
                  waitingPayment ? (
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs text-muted-foreground">
                        {fee !== null
                          ? `Tu envío: S/ ${fee.toFixed(2)} · esperando que el cliente elija cómo pagar.`
                          : 'Esperando que el cliente elija cómo pagar el envío.'}
                      </p>
                      <RetractOfferButton orderId={order.id} deliveryFee={fee} />
                    </div>
                  ) : paysOnDelivery && collectedAt ? (
                    // Ya cobró: la constancia en verde, con el medio como TEXTO
                    // y no solo color (mismo criterio que el chip ámbar).
                    // Región viva: el chip pasa de "Cobrar…" a "Cobrado" tras la
                    // acción del propio repartidor, y ese cambio no se anuncia solo.
                    <span
                      role="status"
                      aria-live="polite"
                      className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-900 dark:bg-emerald-500/15 dark:text-emerald-100"
                    >
                      <CheckCircle2Icon className="h-3.5 w-3.5" aria-hidden />
                      Cobrado · {collectedMethod === 'YAPE' ? 'Yape' : 'efectivo'}
                    </span>
                  ) : paysOnDelivery ? (
                    // El dato ACCIONABLE de un pedido que se paga al recibir:
                    // cuánto cobrar en la puerta (comida + envío, D1) y con qué
                    // medio anunció el cliente. Texto + ícono, nunca solo color.
                    <span className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-900 dark:bg-amber-500/15 dark:text-amber-100">
                      {paymentMethod === 'YAPE' ? (
                        <SmartphoneIcon className="h-3.5 w-3.5" aria-hidden />
                      ) : (
                        <BanknoteIcon className="h-3.5 w-3.5" aria-hidden />
                      )}
                      Cobrar S/ {due.toFixed(2)} al entregar
                      {paymentMethod === 'YAPE' ? ' · pagará con Yape' : ' en efectivo'}
                    </span>
                  ) : order.deliveries?.payment_voucher_path ? (
                    // Indicador, no la imagen: cargar la miniatura en la lista
                    // exigiría firmar una URL por fila (y una petición de
                    // Storage por pedido) para mostrar un dato del que no se
                    // puede leer nada a ese tamaño. El comprobante se ve en el
                    // detalle, con su monto al lado.
                    <Link
                      href={`/repartidor/pedidos/${order.id}`}
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 hover:underline dark:text-emerald-400"
                    >
                      <PaperclipIcon className="h-3.5 w-3.5" aria-hidden />
                      Comprobante adjunto
                    </Link>
                  ) : undefined
                }
              />
            )
          })}
        </div>
      )}

      {!error && orders.length === 0 && (
        <EmptyState
          title="No tienes entregas activas"
          description="Ve a Disponibles para ofertar por un pedido."
          className="mt-10"
        />
      )}
    </>
  )
}
