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
import { ProductForm } from './ProductForm'
import { PlusIcon } from 'lucide-react'

/**
 * Nuevo producto en modal, desde el header de /restaurante/productos (mismo
 * lugar y estilo que antes, sin navegar a otra página). El formulario se monta
 * solo al abrir (`open &&`), así cada apertura empieza vacío.
 */
export function ProductCreateDialog({
  categories,
  restaurantId,
}: {
  categories: { id: string; name: string }[]
  restaurantId: string
}) {
  const [open, setOpen] = useState(false)
  const router = useRouter()

  function handleSaved() {
    setOpen(false)
    router.refresh()
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="lime" />}>
        <PlusIcon />
        Nuevo producto
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nuevo producto</DialogTitle>
          <DialogDescription>
            Va a aparecer disponible de inmediato en tu carta, a menos que
            desactives el interruptor de abajo.
          </DialogDescription>
        </DialogHeader>
        {open && (
          <ProductForm
            categories={categories}
            restaurantId={restaurantId}
            onSaved={handleSaved}
            onCancel={() => setOpen(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
