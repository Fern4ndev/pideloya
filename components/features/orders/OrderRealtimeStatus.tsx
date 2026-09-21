'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/db/client'
import { OrderStatusTimeline } from './OrderStatusTimeline'
import type { OrderStatus } from '@/lib/constants/order-status'

export function OrderRealtimeStatus({
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

  return <OrderStatusTimeline status={status} />
}
