'use client'

import { useState, useTransition } from 'react'
import { updateDeliveryPerson } from '@/lib/actions/admin'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type DeliveryPerson = {
  id: string
  full_name: string
  phone: string | null
  document_type: string | null
  document_number: string | null
  vehicle_type: string | null
}

export function EditDeliveryDialog({
  open,
  onOpenChange,
  deliveryPerson,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  deliveryPerson: DeliveryPerson
}) {
  const [fullName, setFullName] = useState(deliveryPerson.full_name)
  const [phone, setPhone] = useState(deliveryPerson.phone ?? '')
  const [documentType, setDocumentType] = useState(deliveryPerson.document_type ?? '')
  const [documentNumber, setDocumentNumber] = useState(deliveryPerson.document_number ?? '')
  const [vehicleType, setVehicleType] = useState(deliveryPerson.vehicle_type ?? '')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    startTransition(async () => {
      try {
        await updateDeliveryPerson(deliveryPerson.id, {
          full_name: fullName,
          phone: phone || undefined,
          document_type: documentType || undefined,
          document_number: documentNumber || undefined,
          vehicle_type: vehicleType || undefined,
        })
        onOpenChange(false)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error al guardar')
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar repartidor</DialogTitle>
          <DialogDescription>
            Modifica la información del repartidor.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="full_name">Nombre completo</Label>
            <Input
              id="full_name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Teléfono</Label>
            <Input
              id="phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="987654321"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="document_type">Tipo doc.</Label>
              <Input
                id="document_type"
                value={documentType}
                onChange={(e) => setDocumentType(e.target.value)}
                placeholder="DNI"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="document_number">Nº documento</Label>
              <Input
                id="document_number"
                value={documentNumber}
                onChange={(e) => setDocumentNumber(e.target.value)}
                placeholder="12345678"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="vehicle_type">Vehículo</Label>
            <Input
              id="vehicle_type"
              value={vehicleType}
              onChange={(e) => setVehicleType(e.target.value)}
              placeholder="Moto, Bicicleta, etc."
            />
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Guardando…' : 'Guardar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
