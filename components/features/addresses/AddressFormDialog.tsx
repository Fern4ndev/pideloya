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
import { AddressForm, type AddressFormValues } from './AddressForm'
import { PlusIcon, PencilIcon } from 'lucide-react'

export function AddressFormDialog({
  mode,
  initialData,
}: {
  mode: 'create' | 'edit'
  initialData?: AddressFormValues
}) {
  const [open, setOpen] = useState(false)
  const router = useRouter()

  function handleSaved() {
    setOpen(false)
    router.refresh()
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          mode === 'create' ? (
            <Button size="sm" className="gap-1.5 rounded-full" />
          ) : (
            <Button variant="ghost" size="icon-sm" title="Editar" />
          )
        }
      >
        {mode === 'create' ? (
          <>
            <PlusIcon className="h-4 w-4" />
            Agregar dirección
          </>
        ) : (
          <PencilIcon className="h-4 w-4" />
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {mode === 'create' ? 'Nueva dirección' : 'Editar dirección'}
          </DialogTitle>
          <DialogDescription>
            {mode === 'create'
              ? 'La usamos para saber a dónde llevar tu pedido.'
              : 'Actualiza los datos de tu dirección de entrega.'}
          </DialogDescription>
        </DialogHeader>
        <AddressForm initialData={initialData} onSaved={handleSaved} />
      </DialogContent>
    </Dialog>
  )
}