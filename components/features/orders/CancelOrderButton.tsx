'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { cancelOrder } from '@/lib/actions/orders'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'

export function CancelOrderButton({ orderId }: { orderId: string }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function handleCancel() {
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
    <AlertDialog>
      <AlertDialogTrigger
        render={
          <Button
            variant="outline"
            className="text-destructive hover:text-destructive"
            disabled={isPending}
          />
        }
      >
        {isPending ? 'Cancelando…' : 'Cancelar pedido'}
      </AlertDialogTrigger>
      {/* Fase 4: AlertDialog accesible (foco atrapado, Escape, roles) en lugar
          de confirm() nativo, que no se puede estilar ni anuncia bien. */}
      <AlertDialogContent size="sm">
        <AlertDialogHeader>
          <AlertDialogTitle>¿Cancelar este pedido?</AlertDialogTitle>
          <AlertDialogDescription>
            No se puede deshacer. El repartidor dejará de verlo y tendrías que
            armar uno nuevo.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Volver</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={isPending}
            onClick={handleCancel}
          >
            {isPending ? 'Cancelando…' : 'Sí, cancelar pedido'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}