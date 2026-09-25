'use client'

import { useTransition } from 'react'
import { toast } from 'sonner'
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
        toast.success('Estado actualizado')
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Algo salió mal')
      }
    })
  }

  return (
    <Button size="sm" variant="lime" disabled={isPending} onClick={handleClick}>
      {isPending ? 'Actualizando…' : label}
    </Button>
  )
}