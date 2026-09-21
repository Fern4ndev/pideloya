'use client'

import { useOrderStatus } from '@/lib/hooks/use-order-status'
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
  const { status } = useOrderStatus(orderId)
  const currentStatus = (status as OrderStatus) ?? initialStatus

  return (
    <>
      <OrderStatusTimeline status={currentStatus} />
      {currentStatus === 'PENDING' && (
        <div className="mt-6">
          <CancelOrderButton orderId={orderId} />
        </div>
      )}
    </>
  )
}
