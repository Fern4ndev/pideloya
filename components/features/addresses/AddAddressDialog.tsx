'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { AddressForm } from './AddressForm'

export function AddAddressDialog() {
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" />}>
        Agregar dirección
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nueva dirección</DialogTitle>
        </DialogHeader>
        <AddressForm onCreated={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  )
}