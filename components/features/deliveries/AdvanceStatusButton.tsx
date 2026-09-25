'use client'

import { useTransition } from 'react'
import { advanceOrderStatus } from '@/lib/actions/deliveries'
import { Button } from '@/components/ui/button'
import type { OrderStatus } from '@/types/order'
import { useToast } from '@/components/ui/toast'

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
  const { success, error } = useToast()

  if (!label) return null

  function handleClick() {
    startTransition(async () => {
      try {
        await advanceOrderStatus(orderId, currentStatus)
        success('Estado actualizado')
      } catch (err) {
        error('Algo salió mal', err instanceof Error ? err.message : undefined)
      }
    })
  }

  return (
    <Button size="sm" variant="lime" disabled={isPending} onClick={handleClick}>
      {isPending ? 'Actualizando…' : label}
    </Button>
  )
}