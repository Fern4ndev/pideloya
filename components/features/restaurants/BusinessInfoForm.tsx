'use client'

import { useState, useTransition, type SubmitEvent } from 'react'
import { updateRestaurant } from '@/lib/actions/restaurants'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const FOOD_TYPES = [
  'Pollería',
  'Comida rápida',
  'Menú / Comida criolla',
  'Pizzería',
  'Chifa',
  'Postres y dulces',
  'Otro',
]

export interface BusinessInfoData {
  name: string
  description: string
  addressText: string
  whatsapp: string
  foodType: string
}

export function BusinessInfoForm({
  initialData,
}: {
  initialData: BusinessInfoData
}) {
  const [form, setForm] = useState(initialData)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setSuccess(false)
    startTransition(async () => {
      try {
        await updateRestaurant(form)
        setSuccess(true)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Algo salió mal')
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="name">
            Nombre del negocio <span className="text-destructive">*</span>
          </Label>
          <Input
            id="name"
            value={form.name}
            autoComplete="organization"
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            required
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="foodType">
            Tipo de comida <span className="text-destructive">*</span>
          </Label>
          <Select
            value={form.foodType}
            onValueChange={(value) =>
              setForm((f) => ({ ...f, foodType: value ?? '' }))
            }
          >
            <SelectTrigger id="foodType" className="w-full">
              <SelectValue placeholder="Selecciona una opción" />
            </SelectTrigger>
            <SelectContent>
              {FOOD_TYPES.map((type) => (
                <SelectItem key={type} value={type}>
                  {type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-1.5 min-w-0">
        <Label htmlFor="description">Descripción</Label>
        <Textarea
          id="description"
          value={form.description}
          onChange={(e) =>
            setForm((f) => ({ ...f, description: e.target.value }))
          }
          rows={2}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="addressText">
            Dirección <span className="text-destructive">*</span>
          </Label>
          <Input
            id="addressText"
            value={form.addressText}
            autoComplete="street-address"
            onChange={(e) =>
              setForm((f) => ({ ...f, addressText: e.target.value }))
            }
            required
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="whatsapp">
            WhatsApp del negocio <span className="text-destructive">*</span>
          </Label>
          <Input
            id="whatsapp"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={form.whatsapp}
            onChange={(e) =>
              setForm((f) => ({ ...f, whatsapp: e.target.value }))
            }
            placeholder="987654321"
            required
          />
        </div>
      </div>

      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {success && <p className="text-sm text-green-600">Guardado.</p>}

      <Button type="submit" variant="lime" disabled={isPending}>
        {isPending ? 'Guardando…' : 'Guardar cambios'}
      </Button>
    </form>
  )
}