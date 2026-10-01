'use client'

import Image from 'next/image'
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { OrderStatusTimeline } from './OrderStatusTimeline'
import { CancelOrderButton } from './CancelOrderButton'
import { formatPePhone } from '@/lib/format/phone'
import type { OrderStatus } from '@/lib/constants/order-status'
import type { PaymentMethod, PaymentTiming } from '@/lib/constants/payment-method'

/**
 * Estado del pedido: puro render de la prop `status`, sin estado propio.
 *
 * ANTES esta sección tenía su propio `useState(initialStatus)` + su propio
 * canal de Postgres Changes. Dos consecuencias, ambas malas:
 *
 * 1. Era un "estado derivado copiado a estado local": al llegar
 *    `router.refresh()` la prop cambiaba, pero el `useState` no se
 *    reinicializa nunca — el timeline podía quedar desincronizado del resto
 *    de la página.
 * 2. El estado vivía DENTRO de este componente, así que el servidor (que
 *    decide qué tarjetas dibuja) nunca se enteraba de la oferta del
 *    repartidor: el timeline avanzaba solo y la tarjeta de pago no aparecía
 *    hasta recargar a mano.
 *
 * Ahora una sola fuente de verdad: el servidor renderiza el estado real y
 * `RealtimeRefresh` (en la página) le avisa cuándo volver a preguntar.
 */
export function OrderStatusSection({
  orderId,
  status,
  paymentMethod = null,
  paymentTiming = null,
  cashAmount = null,
  courierQrUrl = null,
  courierName = null,
  courierPhone = null,
}: {
  orderId: string
  status: OrderStatus
  /** Método anunciado por el cliente (snapshot de `orders`). */
  paymentMethod?: PaymentMethod | null
  /** Cuándo paga (snapshot de `orders`): ON_DELIVERY agrega el recordatorio. */
  paymentTiming?: PaymentTiming | null
  /** Monto a pagar al recibir (comida + envío, D1). */
  cashAmount?: number | null
  /** QR y datos del repartidor, para "Ver QR" en un pedido Yape al recibir. */
  courierQrUrl?: string | null
  courierName?: string | null
  courierPhone?: string | null
}) {
  // Entregado: la card de estados ya no aporta nada — el pedido terminó su
  // ciclo. Se oculta completa (wrapper incluido) para que el resto del detalle
  // suba sin un bloque vacío. Como `status` llega del servidor, aplica tanto
  // al abrir un pedido ya entregado como a la transición en vivo mientras el
  // cliente está en la página.
  if (status === 'DELIVERED') return null

  // Legacy sin timing: el único "al recibir" que existía era el efectivo.
  const onDelivery =
    paymentTiming === 'ON_DELIVERY' || (paymentTiming === null && paymentMethod === 'CASH')

  return (
    // Sin margen propio: el espaciado lo controla el grid del layout de la
    // página (Fase 2.1). Asumir que es el primer bloque de la página rompía
    // el espaciado cuando la página lo reordenaba.
    <div className="rounded-3xl border border-black/5 bg-white/70 p-5 shadow-client-card backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
      <OrderStatusTimeline status={status} />
      {/* Recordatorio del pago al recibir (Fase 4.5 del plan "Pagar al
          recibir"): mientras el pedido avanza el cliente ya no puede cambiar
          nada, pero TODAVÍA tiene que preparar la plata (o su app de Yape), y
          esta es la única pantalla que va a volver a mirar. Va dentro de esta
          tarjeta y no en una nueva: es una nota sobre el estado del pedido.

          No hace falta condicionar por estado: payment_timing = 'ON_DELIVERY'
          solo existe a partir de ASSIGNED, y en DELIVERED la sección entera
          devuelve null. */}
      {onDelivery && cashAmount !== null && (
        <div className="mt-4 rounded-2xl bg-amber-100/60 px-4 py-3 text-sm text-amber-900 dark:bg-amber-500/15 dark:text-amber-100">
          <p>
            Recuerda: pagas{' '}
            <span className="font-semibold tabular-nums">
              S/ {cashAmount.toFixed(2)}{' '}
              {paymentMethod === 'YAPE' ? 'por Yape' : 'en efectivo'}
            </span>{' '}
            cuando te entregue el pedido.
          </p>
          {/* Con Yape anunciado, el QR del repartidor a un toque (usa
              yape_qr_url/phone que get_delivery_offer_details ya devuelve en
              estados vivos; sin RPC nueva). Fondo blanco fijo: el QR debe
              escanearse también con el teléfono en modo oscuro. */}
          {paymentMethod === 'YAPE' && (courierQrUrl || courierPhone) && (
            <Dialog>
              <DialogTrigger
                render={
                  <button
                    type="button"
                    className="mt-2 inline-flex min-h-9 items-center gap-1.5 rounded-full border border-amber-600 px-3 text-xs font-medium text-amber-900 transition-colors hover:bg-amber-200/60 dark:border-amber-400/70 dark:text-amber-100 dark:hover:bg-amber-500/20"
                  />
                }
              >
                Ver QR de mi repartidor
              </DialogTrigger>
              <DialogContent className="flex w-[min(100%-2rem,24rem)] flex-col items-center gap-4 rounded-3xl bg-white text-neutral-900 sm:max-w-sm">
                <DialogTitle className="pt-2 text-center text-base font-semibold text-neutral-900">
                  Escanéalo y yapea S/ {cashAmount.toFixed(2)} al recibir
                </DialogTitle>
                {courierQrUrl ? (
                  <div className="rounded-2xl bg-white p-2 ring-1 ring-neutral-200">
                    <div className="relative h-72 w-72 max-w-full">
                      <Image
                        src={courierQrUrl}
                        alt={`QR de Yape de ${courierName ?? 'tu repartidor'}`}
                        fill
                        sizes="288px"
                        className="object-contain"
                      />
                    </div>
                  </div>
                ) : (
                  <p className="rounded-2xl border border-dashed border-neutral-300 px-4 py-6 text-center text-sm text-neutral-600">
                    {courierName ?? 'Tu repartidor'} todavía no cargó su QR. Yapea al número de
                    abajo al recibir.
                  </p>
                )}
                {courierPhone && (
                  <p className="select-all pb-2 text-lg font-semibold tabular-nums tracking-wide text-neutral-900">
                    {formatPePhone(courierPhone.replace(/\D/g, ''))}
                  </p>
                )}
              </DialogContent>
            </Dialog>
          )}
        </div>
      )}
      {/* Cancelable mientras el cliente NO haya cerrado su elección de pago
          (PENDING o AWAITING_PAYMENT): en ese punto todavía no se movió nada de
          manos — sin método elegido no hay repartidor en camino ni voucher
          subido que borrar, y ninguna de las dos partes arriesgó nada. Desde la
          Fase 1 del plan del método de pago, "pago confirmado" incluye al
          efectivo (donde el dinero recién se cobra al entregar): el corte lo
          sigue marcando `payment_confirmed_at`, que solo se escribe al elegir.
          Mismo criterio que la policy orders_update_own_customer_cancel, que es
          la que decide de verdad. */}
      {(status === 'PENDING' || status === 'AWAITING_PAYMENT') && (
        <div className="mt-6">
          <CancelOrderButton orderId={orderId} />
        </div>
      )}
    </div>
  )
}
