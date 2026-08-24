'use client'

import Link from 'next/link'
import { useTransition } from 'react'
import { toggleProductAvailability, deleteProduct } from '@/lib/actions/products'
import { Button } from '@/components/ui/button'

export function ProductRowActions({
  productId,
  available,
}: {
  productId: string
  available: boolean
}) {
  const [isPending, startTransition] = useTransition()

  function handleToggle() {
    startTransition(() => { toggleProductAvailability(productId, !available) })
  }

  function handleDelete() {
    if (!confirm('¿Eliminar este producto? Esta acción no se puede deshacer.')) {
      return
    }
    startTransition(() => { deleteProduct(productId) })
  }

  return (
    <div className="flex justify-end gap-2">
      <Button
        size="sm"
        variant="outline"
        disabled={isPending}
        onClick={handleToggle}
      >
        {available ? 'Desactivar' : 'Activar'}
      </Button>
      <Button
        size="sm"
        variant="ghost"
        render={<Link href={`/restaurante/productos/${productId}`} />}
      >
        Editar
      </Button>
      <Button
        size="sm"
        variant="ghost"
        className="text-destructive hover:text-destructive"
        disabled={isPending}
        onClick={handleDelete}
      >
        Eliminar
      </Button>
    </div>
  )
}