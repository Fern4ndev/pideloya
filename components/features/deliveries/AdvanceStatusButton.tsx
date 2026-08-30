'use client'

import { useTransition } from 'react'
import { advanceOrderStatus } from '@/lib/actions/deliveries'
import { Button } from '@/components/ui/button'
import type { OrderStatus } from '@/types/order'

const NEXT_LABEL: Record<string, string> = {
  ASSIGNED: 'Marcar como recogido',
  PICKED_UP: 'Marcar en camino',
  ON_THE_WAY: 'Marcar entregado',
}

export function AdvanceStatusButton({
  orderId,
  currentStatus,
}: {
  orderId: string
  currentStatus: OrderStatus
}) {
  const [isPending, startTransition] = useTransition()
  const label = NEXT_LABEL[currentStatus]

  if (!label) return null

  function handleClick() {
    startTransition(async () => {
      try {
        await advanceOrderStatus(orderId, currentStatus)
      } catch (err) {
        alert(err instanceof Error ? err.message : 'Algo salió mal')
      }
    })
  }

  return (
    <Button size="sm" disabled={isPending} onClick={handleClick}>
      {isPending ? 'Actualizando…' : label}
    </Button>
  )
}