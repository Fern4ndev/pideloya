'use client'

import { useState, useTransition, type SubmitEvent } from 'react'
import { registerRestaurant } from '@/lib/actions/registration'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
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

const EMPTY_FORM = {
  restaurantName: '',
  foodType: '',
  addressText: '',
  whatsapp: '',
  ownerPhone: '',
  ownerFullName: '',
  ownerEmail: '',
  password: '',
  consent: false,
}

export function RestaurantRegisterForm() {
  const [form, setForm] = useState(EMPTY_FORM)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      try {
        await registerRestaurant(form)
        setForm(EMPTY_FORM)
        setSuccess(true)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Algo salió mal')
      }
    })
  }

  if (success) {
    return (
      <div className="rounded-xl border bg-muted/40 p-6 text-center">
        <p className="font-medium">¡Listo! Registramos tu negocio.</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Vamos a revisar tu información y activar tu cuenta. Te
          contactaremos por WhatsApp al número que registraste.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="space-y-1">
        <Label htmlFor="restaurantName">Nombre del restaurante</Label>
        <Input
          id="restaurantName"
          value={form.restaurantName}
          onChange={(e) =>
            setForm((f) => ({ ...f, restaurantName: e.target.value }))
          }
          required
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor="foodType">Tipo de comida</Label>
        <Select
          value={form.foodType}
          onValueChange={(value) => setForm((f) => ({ ...f, foodType: value ?? '' }))}
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

      <div className="space-y-1">
        <Label htmlFor="addressText">Dirección del restaurante</Label>
        <Input
          id="addressText"
          value={form.addressText}
          onChange={(e) =>
            setForm((f) => ({ ...f, addressText: e.target.value }))
          }
          placeholder="Av. Arenas 123, Abancay"
          required
        />
      </div>

      <div className="grid grid-cols-[100px_1fr] gap-2">
        <div className="space-y-1">
          <Label>Prefijo</Label>
          <div className="flex h-9 items-center rounded-md border bg-muted px-3 text-sm text-muted-foreground">
            +51
          </div>
        </div>
        <div className="space-y-1">
          <Label htmlFor="whatsapp">WhatsApp del negocio</Label>
          <Input
            id="whatsapp"
            inputMode="numeric"
            value={form.whatsapp}
            onChange={(e) =>
              setForm((f) => ({ ...f, whatsapp: e.target.value }))
            }
            placeholder="987654321"
            required
          />
        </div>
      </div>

      <div className="space-y-1">
        <Label htmlFor="ownerFullName">Nombre del responsable</Label>
        <Input
          id="ownerFullName"
          value={form.ownerFullName}
          onChange={(e) =>
            setForm((f) => ({ ...f, ownerFullName: e.target.value }))
          }
          required
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor="ownerPhone">Tu celular</Label>
        <Input
          id="ownerPhone"
          inputMode="numeric"
          value={form.ownerPhone}
          onChange={(e) =>
            setForm((f) => ({ ...f, ownerPhone: e.target.value }))
          }
          placeholder="987654321"
          required
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor="ownerEmail">E-mail del responsable</Label>
        <Input
          id="ownerEmail"
          type="email"
          value={form.ownerEmail}
          onChange={(e) =>
            setForm((f) => ({ ...f, ownerEmail: e.target.value }))
          }
          required
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor="password">Crea una contraseña</Label>
        <Input
          id="password"
          type="password"
          value={form.password}
          onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
          required
        />
      </div>

      <div className="flex items-start gap-2 pt-1">
        <Checkbox
          id="consent"
          checked={form.consent}
          onCheckedChange={(checked) =>
            setForm((f) => ({ ...f, consent: checked === true }))
          }
        />
        <Label
          htmlFor="consent"
          className="text-xs font-normal leading-snug text-muted-foreground"
        >
          Autorizo el tratamiento de mis datos personales para comunicaciones
          vía WhatsApp, conforme a la Política de Privacidad de PideloYa.
        </Label>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? 'Registrando…' : 'Registrar restaurante'}
      </Button>
    </form>
  )
}