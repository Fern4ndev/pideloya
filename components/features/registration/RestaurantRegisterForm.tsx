'use client'

import { useState, useTransition, type SubmitEvent } from 'react'
import { Icon } from '@iconify-icon/react'
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
      <div className="bg-surface-50 rounded-4xl p-8 md:p-10 border border-border text-center">
        <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center shadow-lg shadow-brand-500/20">
          <Icon icon="lucide:check" width="28" height="28" className="text-white" />
        </div>
        <p className="font-medium text-lg">¡Listo! Registramos tu negocio.</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Vamos a revisar tu información y activar tu cuenta. Te
          contactaremos por WhatsApp al número que registraste.
        </p>
      </div>
    )
  }

  return (
    <div className="bg-surface-50 rounded-4xl p-8 md:p-10 border border-border">
      <div className="flex items-center gap-4 mb-8">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center shadow-lg shadow-brand-500/20">
          <Icon icon="lucide:store" width="28" height="28" className="text-white" />
        </div>
        <div>
          <h3 className="text-xl font-bold">Registra tu negocio</h3>
          <p className="text-sm text-muted-foreground">Llega a más clientes en Abancay</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label htmlFor="restaurantName" className="mb-2 block font-semibold">Nombre del restaurante</Label>
          <Input
            id="restaurantName"
            value={form.restaurantName}
            onChange={(e) =>
              setForm((f) => ({ ...f, restaurantName: e.target.value }))
            }
            placeholder="Mi restaurante"
            className="h-12 rounded-xl bg-muted/50 border-transparent focus:border-brand-500 focus:ring-2 focus:ring-brand-500/10"
            required
          />
        </div>

        <div>
          <Label htmlFor="foodType" className="mb-2 block font-semibold">Tipo de comida</Label>
          <Select
            value={form.foodType}
            onValueChange={(value) => setForm((f) => ({ ...f, foodType: value ?? '' }))}
          >
            <SelectTrigger id="foodType" className="w-full h-12 rounded-xl bg-muted/50 border-transparent focus:border-brand-500 focus:ring-2 focus:ring-brand-500/10">
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

        <div>
          <Label htmlFor="addressText" className="mb-2 block font-semibold">Dirección del restaurante</Label>
          <Input
            id="addressText"
            value={form.addressText}
            onChange={(e) =>
              setForm((f) => ({ ...f, addressText: e.target.value }))
            }
            placeholder="Av. Arenas 123, Abancay"
            className="h-12 rounded-xl bg-muted/50 border-transparent focus:border-brand-500 focus:ring-2 focus:ring-brand-500/10"
            required
          />
        </div>

        <div className="grid grid-cols-[80px_1fr] gap-3">
          <div>
            <Label className="mb-2 block font-semibold">Prefijo</Label>
            <div className="flex h-12 items-center justify-center rounded-xl border border-border bg-muted text-sm font-medium text-muted-foreground">
              +51
            </div>
          </div>
          <div>
            <Label htmlFor="whatsapp" className="mb-2 block font-semibold">WhatsApp del negocio</Label>
            <Input
              id="whatsapp"
              inputMode="numeric"
              value={form.whatsapp}
              onChange={(e) =>
                setForm((f) => ({ ...f, whatsapp: e.target.value }))
              }
              placeholder="987654321"
              className="h-12 rounded-xl bg-muted/50 border-transparent focus:border-brand-500 focus:ring-2 focus:ring-brand-500/10"
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="ownerFullName" className="mb-2 block font-semibold">Nombre del responsable</Label>
            <Input
              id="ownerFullName"
              value={form.ownerFullName}
              onChange={(e) =>
                setForm((f) => ({ ...f, ownerFullName: e.target.value }))
              }
              className="h-12 rounded-xl bg-muted/50 border-transparent focus:border-brand-500 focus:ring-2 focus:ring-brand-500/10"
              required
            />
          </div>
          <div>
            <Label htmlFor="ownerPhone" className="mb-2 block font-semibold">Tu celular</Label>
            <Input
              id="ownerPhone"
              inputMode="numeric"
              value={form.ownerPhone}
              onChange={(e) =>
                setForm((f) => ({ ...f, ownerPhone: e.target.value }))
              }
              placeholder="987654321"
              className="h-12 rounded-xl bg-muted/50 border-transparent focus:border-brand-500 focus:ring-2 focus:ring-brand-500/10"
              required
            />
          </div>
        </div>

        <div>
          <Label htmlFor="ownerEmail" className="mb-2 block font-semibold">E-mail del responsable</Label>
          <Input
            id="ownerEmail"
            type="email"
            value={form.ownerEmail}
            onChange={(e) =>
              setForm((f) => ({ ...f, ownerEmail: e.target.value }))
            }
            className="h-12 rounded-xl bg-muted/50 border-transparent focus:border-brand-500 focus:ring-2 focus:ring-brand-500/10"
            required
          />
        </div>

        <div>
          <Label htmlFor="restPassword" className="mb-2 block font-semibold">Crea una contraseña</Label>
          <Input
            id="restPassword"
            type="password"
            value={form.password}
            onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            className="h-12 rounded-xl bg-muted/50 border-transparent focus:border-brand-500 focus:ring-2 focus:ring-brand-500/10"
            required
          />
        </div>

        <div className="flex items-start gap-3 pt-2">
          <Checkbox
            id="consent"
            checked={form.consent}
            onCheckedChange={(checked) =>
              setForm((f) => ({ ...f, consent: checked === true }))
            }
            className="mt-1"
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

        <Button
          type="submit"
          className="w-full h-12 rounded-xl btn-brand text-white font-semibold"
          disabled={isPending}
        >
          {isPending ? 'Registrando…' : 'Registrar restaurante'}
        </Button>
      </form>
    </div>
  )
}
