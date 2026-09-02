'use client'

import { useState, useTransition, type SubmitEvent } from 'react'
import { Icon } from '@iconify-icon/react'
import { registerDeliveryPerson } from '@/lib/actions/registration'
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

const DOCUMENT_TYPES = ['DNI', 'Carné de extranjería', 'Pasaporte']
const VEHICLE_TYPES = ['Moto', 'Mototaxi', 'Bicicleta', 'A pie', 'Auto']

const EMPTY_FORM = {
  fullName: '',
  documentType: '',
  documentNumber: '',
  vehicleType: '',
  phone: '',
  email: '',
  password: '',
  ageConfirmed: false,
  consent: false,
}

export function DeliveryRegisterForm() {
  const [form, setForm] = useState(EMPTY_FORM)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      try {
        await registerDeliveryPerson(form)
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
        <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-500/20">
          <Icon icon="lucide:check" width="28" height="28" className="text-white" />
        </div>
        <p className="font-medium text-lg">¡Listo! Recibimos tu registro.</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Vamos a validar tus datos y activar tu cuenta. Te contactaremos
          por WhatsApp.
        </p>
      </div>
    )
  }

  return (
    <div className="bg-surface-50 rounded-4xl p-8 md:p-10 border border-border">
      <div className="flex items-center gap-4 mb-8">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-500/20">
          <Icon icon="lucide:zap" width="28" height="28" className="text-white" />
        </div>
        <div>
          <h3 className="text-xl font-bold">Conviértete en repartidor</h3>
          <p className="text-sm text-muted-foreground">Gana dinero a tu ritmo en Abancay</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label htmlFor="fullName" className="mb-2 block font-semibold">Nombre completo</Label>
          <Input
            id="fullName"
            value={form.fullName}
            onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
            className="h-12 rounded-xl bg-muted/50 border-transparent focus:border-brand-500 focus:ring-2 focus:ring-brand-500/10"
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="documentType" className="mb-2 block font-semibold">Tipo de documento</Label>
            <Select
              value={form.documentType}
              onValueChange={(value) =>
                setForm((f) => ({ ...f, documentType: value ?? '' }))
              }
            >
              <SelectTrigger id="documentType" className="w-full h-12 rounded-xl bg-muted/50 border-transparent focus:border-brand-500 focus:ring-2 focus:ring-brand-500/10">
                <SelectValue placeholder="Selecciona" />
              </SelectTrigger>
              <SelectContent>
                {DOCUMENT_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="documentNumber" className="mb-2 block font-semibold">N° de documento</Label>
            <Input
              id="documentNumber"
              value={form.documentNumber}
              onChange={(e) =>
                setForm((f) => ({ ...f, documentNumber: e.target.value }))
              }
              className="h-12 rounded-xl bg-muted/50 border-transparent focus:border-brand-500 focus:ring-2 focus:ring-brand-500/10"
              required
            />
          </div>
        </div>

        <div>
          <Label htmlFor="vehicleType" className="mb-2 block font-semibold">¿Cómo vas a repartir?</Label>
          <Select
            value={form.vehicleType}
            onValueChange={(value) =>
              setForm((f) => ({ ...f, vehicleType: value ?? '' }))
            }
          >
            <SelectTrigger id="vehicleType" className="w-full h-12 rounded-xl bg-muted/50 border-transparent focus:border-brand-500 focus:ring-2 focus:ring-brand-500/10">
              <SelectValue placeholder="Selecciona una opción" />
            </SelectTrigger>
            <SelectContent>
              {VEHICLE_TYPES.map((type) => (
                <SelectItem key={type} value={type}>
                  {type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="phone" className="mb-2 block font-semibold">Celular (WhatsApp)</Label>
            <Input
              id="phone"
              inputMode="numeric"
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              placeholder="987654321"
              className="h-12 rounded-xl bg-muted/50 border-transparent focus:border-brand-500 focus:ring-2 focus:ring-brand-500/10"
              required
            />
          </div>
          <div>
            <Label htmlFor="email" className="mb-2 block font-semibold">E-mail</Label>
            <Input
              id="email"
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              className="h-12 rounded-xl bg-muted/50 border-transparent focus:border-brand-500 focus:ring-2 focus:ring-brand-500/10"
              required
            />
          </div>
        </div>

        <div>
          <Label htmlFor="repPassword" className="mb-2 block font-semibold">Crea una contraseña</Label>
          <Input
            id="repPassword"
            type="password"
            value={form.password}
            onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            className="h-12 rounded-xl bg-muted/50 border-transparent focus:border-brand-500 focus:ring-2 focus:ring-brand-500/10"
            required
          />
        </div>

        <div className="flex items-start gap-3 pt-2">
          <Checkbox
            id="ageConfirmed"
            checked={form.ageConfirmed}
            onCheckedChange={(checked) =>
              setForm((f) => ({ ...f, ageConfirmed: checked === true }))
            }
            className="mt-1"
          />
          <Label
            htmlFor="ageConfirmed"
            className="text-xs font-normal leading-snug text-muted-foreground"
          >
            Confirmo que soy mayor de edad (18 años o más).
          </Label>
        </div>

        <div className="flex items-start gap-3">
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
          {isPending ? 'Registrando…' : 'Registrarme ahora'}
        </Button>
      </form>
    </div>
  )
}
