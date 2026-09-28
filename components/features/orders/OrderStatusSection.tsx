'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/db/client'
import { OrderStatusTimeline } from './OrderStatusTimeline'
import { CancelOrderButton } from './CancelOrderButton'
import type { OrderStatus } from '@/lib/constants/order-status'

export function OrderStatusSection({
  orderId,
  initialStatus,
}: {
  orderId: string
  initialStatus: OrderStatus
}) {
  const [status, setStatus] = useState<OrderStatus>(initialStatus)

  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel(`order-${orderId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `id=eq.${orderId}`,
        },
        (payload) => {
          if (payload.new.status) {
            setStatus(payload.new.status as OrderStatus)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [orderId])

  // Entregado: la card de estados ya no aporta nada — el pedido terminó su
  // ciclo. Se oculta completa (wrapper incluido) para que el resto del detalle
  // suba sin un bloque vacío. Como `status` nace de `initialStatus` y se
  // actualiza por realtime, aplica tanto al abrir un pedido ya entregado como
  // a la transición en vivo mientras el cliente está en la página.
  if (status === 'DELIVERED') return null

  return (
    // Sin margen propio: el espaciado lo controla el grid del layout de la
    // página (Fase 2.1). Asumir que es el primer bloque de la página rompía
    // el espaciado cuando la página lo reordenaba.
    <div className="rounded-3xl border border-black/5 bg-white/70 p-5 shadow-client-card backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
      <OrderStatusTimeline status={status} />
      {/* Cancelable mientras el pago del envío NO esté confirmado (PENDING o
          AWAITING_PAYMENT): dentro de la plataforma todavía no se movió nada de
          manos — el envío se paga por Yape, fuera de la app, y aún no se
          confirmó. Mismo criterio que la policy
          orders_update_own_customer_cancel, que es la que decide de verdad. */}
      {(status === 'PENDING' || status === 'AWAITING_PAYMENT') && (
        <div className="mt-6">
          <CancelOrderButton orderId={orderId} />
        </div>
      )}
    </div>
  )
}
