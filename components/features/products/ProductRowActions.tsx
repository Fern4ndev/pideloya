'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toggleProductAvailability, deleteProduct } from '@/lib/actions/products'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { ProductEditDialog } from './ProductEditDialog'
import type { ProductFormData } from './ProductForm'
import { TrashIcon } from 'lucide-react'

export function ProductRowActions({
  product,
  categories,
}: {
  product: ProductFormData & { id: string; restaurantId: string }
  categories: { id: string; name: string }[]
}) {
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function handleToggle() {
    startTransition(async () => {
      await toggleProductAvailability(product.id, !product.available)
      router.refresh()
    })
  }

  function handleDelete() {
    if (!confirm('¿Eliminar este producto? Esta acción no se puede deshacer.')) {
      return
    }
    startTransition(async () => {
      await deleteProduct(product.id)
      router.refresh()
    })
  }

  return (
    <div className="flex items-center justify-end gap-1">
      <Switch
        checked={product.available}
        onCheckedChange={handleToggle}
        disabled={isPending}
      />
      <ProductEditDialog product={product} categories={categories} />
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
