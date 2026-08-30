'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { cancelOrder } from '@/lib/actions/orders'
import { Button } from '@/components/ui/button'

export function CancelOrderButton({ orderId }: { orderId: string }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function handleCancel() {
    if (!confirm('¿Cancelar este pedido? No se puede deshacer.')) return

    startTransition(async () => {
      try {
        await cancelOrder(orderId)
        router.refresh()
      } catch (err) {
        alert(err instanceof Error ? err.message : 'Algo salió mal')
      }
    })
  }

  return (
    <Button
      variant="outline"
      className="text-destructive hover:text-destructive"
      disabled={isPending}
      onClick={handleCancel}
    >
      {isPending ? 'Cancelando…' : 'Cancelar pedido'}
    </Button>
  )
}