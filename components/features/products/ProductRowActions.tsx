'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { deleteProduct } from '@/lib/actions/products'
import { Button } from '@/components/ui/button'
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
