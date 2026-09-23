'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { ProductForm, type ProductFormData } from './ProductForm'
import { PencilIcon } from 'lucide-react'

export function ProductEditDialog({
  product,
  categories,
}: {
  product: ProductFormData & { id: string; restaurantId: string }
  categories: { id: string; name: string }[]
}) {
  const [open, setOpen] = useState(false)
  const router = useRouter()

  function handleSaved() {
    setOpen(false)
    router.refresh()
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="ghost" size="icon-sm" title="Editar" />}>
        <PencilIcon className="h-4 w-4" />
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar {product.name}</DialogTitle>
          <DialogDescription>
            Actualiza los datos de este producto. Los cambios se reflejan en tu carta pública.
          </DialogDescription>
        </DialogHeader>
        <ProductForm
          productId={product.id}
          categories={categories}
          restaurantId={product.restaurantId}
          initialData={product}
          onSaved={handleSaved}
          onCancel={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  )
}