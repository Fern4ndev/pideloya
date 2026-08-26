'use client'

import { useTransition } from 'react'
import { deleteAddress } from '@/lib/actions/addresses'
import { Button } from '@/components/ui/button'

export function DeleteAddressButton({ addressId }: { addressId: string }) {
  const [isPending, startTransition] = useTransition()

  function handleDelete() {
    if (!confirm('¿Eliminar esta dirección?')) return
    startTransition(() => {
      deleteAddress(addressId)
    })
  }

  return (
    <Button
      size="sm"
      variant="ghost"
      className="text-destructive hover:text-destructive"
      disabled={isPending}
      onClick={handleDelete}
    >
      Eliminar
    </Button>
  )
}