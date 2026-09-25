'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { acceptOrder } from '@/lib/actions/deliveries'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'

export function AcceptOrderButton({ orderId }: { orderId: string }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const { error, success } = useToast()

  function handleAccept() {
    startTransition(async () => {
      try {
        await acceptOrder(orderId)
        success('Pedido aceptado')
        router.push('/repartidor/pedidos')
      } catch (err) {
        error('Algo salió mal', err instanceof Error ? err.message : undefined)
      }
    })
  }

  return (
    <Button size="sm" variant="lime" className="mt-2" disabled={isPending} onClick={handleAccept}>
      {isPending ? 'Aceptando…' : 'Aceptar'}
    </Button>
  )
}