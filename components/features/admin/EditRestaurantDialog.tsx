'use client'

import { useState, useTransition } from 'react'
import { updateRestaurant } from '@/lib/actions/admin'
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

type Restaurant = {
  id: string
  name: string
  food_type: string | null
  whatsapp: string | null
  address_text: string | null
}

export function EditRestaurantDialog({
  open,
  onOpenChange,
  restaurant,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  restaurant: Restaurant
}) {
  const [name, setName] = useState(restaurant.name)
  const [foodType, setFoodType] = useState(restaurant.food_type ?? '')
  const [whatsapp, setWhatsapp] = useState(restaurant.whatsapp ?? '')
  const [addressText, setAddressText] = useState(restaurant.address_text ?? '')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    startTransition(async () => {
      try {
        await updateRestaurant(restaurant.id, {
          name,
          food_type: foodType || undefined,
          whatsapp: whatsapp || undefined,
          address_text: addressText || undefined,
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
          <DialogTitle>Editar restaurante</DialogTitle>
          <DialogDescription>
            Modifica la información del restaurante.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nombre</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="food_type">Tipo de comida</Label>
            <Input
              id="food_type"
              value={foodType}
              onChange={(e) => setFoodType(e.target.value)}
              placeholder="Ej: Criollo, Pizzería"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="whatsapp">WhatsApp</Label>
            <Input
              id="whatsapp"
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              placeholder="987654321"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Dirección</Label>
            <Input
              id="address"
              value={addressText}
              onChange={(e) => setAddressText(e.target.value)}
              placeholder="Dirección del local"
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
            <Button type="submit" variant="lime" disabled={isPending}>
              {isPending ? 'Guardando…' : 'Guardar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
