'use client'

import Link from 'next/link'
import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toggleProductAvailability, deleteProduct } from '@/lib/actions/products'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { PencilIcon, TrashIcon } from 'lucide-react'

export function ProductRowActions({
  productId,
  available,
}: {
  productId: string
  available: boolean
}) {
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function handleToggle() {
    startTransition(async () => {
      await toggleProductAvailability(productId, !available)
      router.refresh()
    })
  }

  function handleDelete() {
    if (!confirm('¿Eliminar este producto? Esta acción no se puede deshacer.')) {
      return
    }
    startTransition(async () => {
      await deleteProduct(productId)
      router.refresh()
    })
  }

  return (
    <div className="flex items-center justify-end gap-1">
      <Switch
        checked={available}
        onCheckedChange={handleToggle}
        disabled={isPending}
      />
      <Button
        variant="ghost"
        size="icon-sm"
        render={<Link href={`/restaurante/productos/${productId}`} />}
        nativeButton={false}
        title="Editar"
      >
        <PencilIcon className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        className="text-destructive hover:text-destructive"
        disabled={isPending}
        onClick={handleDelete}
        title="Eliminar"
      >
        <TrashIcon className="h-4 w-4" />
      </Button>
    </div>
  )
}
