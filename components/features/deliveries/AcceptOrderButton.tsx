'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { acceptOrder } from '@/lib/actions/deliveries'
import { Button } from '@/components/ui/button'

export function AcceptOrderButton({ orderId }: { orderId: string }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function handleAccept() {
    startTransition(async () => {
      try {
        await acceptOrder(orderId)
        router.push('/repartidor/pedidos')
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Algo salió mal')
      }
    })
  }

  return (
    <Button size="sm" variant="lime" className="mt-2" disabled={isPending} onClick={handleAccept}>
      {isPending ? 'Aceptando…' : 'Aceptar'}
    </Button>
  )
}