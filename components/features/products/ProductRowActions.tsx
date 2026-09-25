'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { deleteProduct } from '@/lib/actions/products'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/features/admin/ConfirmDialog'
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
  const [confirmOpen, setConfirmOpen] = useState(false)
  const router = useRouter()

  async function handleDelete() {
    await deleteProduct(product.id)
    router.refresh()
  }

  return (
    <div className="flex items-center justify-end gap-1">
      <ProductEditDialog product={product} categories={categories} />
      <Button
        variant="ghost"
        size="icon-sm"
        className="text-destructive hover:text-destructive"
        onClick={() => setConfirmOpen(true)}
        title="Eliminar"
      >
        <TrashIcon className="h-4 w-4" />
      </Button>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="¿Eliminar producto?"
        description="Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        onConfirm={handleDelete}
      />
    </div>
  )
}
