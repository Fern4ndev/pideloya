'use client'

import { useState, useTransition, type SubmitEvent } from 'react'
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
      <div className="rounded-xl border bg-muted/40 p-6 text-center">
        <p className="font-medium">¡Listo! Recibimos tu registro.</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Vamos a validar tus datos y activar tu cuenta. Te contactaremos
          por WhatsApp.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="space-y-1">
        <Label htmlFor="fullName">Nombre completo</Label>
        <Input
          id="fullName"
          value={form.fullName}
          onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label htmlFor="documentType">Tipo de documento</Label>
          <Select
            value={form.documentType}
            onValueChange={(value) =>
              setForm((f) => ({ ...f, documentType: value ?? '' }))
            }
          >
            <SelectTrigger id="documentType" className="w-full">
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
        <div className="space-y-1">
          <Label htmlFor="documentNumber">N° de documento</Label>
          <Input
            id="documentNumber"
            value={form.documentNumber}
            onChange={(e) =>
              setForm((f) => ({ ...f, documentNumber: e.target.value }))
            }
            required
          />
        </div>
      </div>

      <div className="space-y-1">
        <Label htmlFor="vehicleType">¿Cómo vas a repartir?</Label>
        <Select
          value={form.vehicleType}
          onValueChange={(value) =>
            setForm((f) => ({ ...f, vehicleType: value ?? '' }))
          }
        >
          <SelectTrigger id="vehicleType" className="w-full">
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

      <div className="space-y-1">
        <Label htmlFor="phone">Celular (WhatsApp)</Label>
        <Input
          id="phone"
          inputMode="numeric"
          value={form.phone}
          onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
          placeholder="987654321"
          required
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor="email">E-mail</Label>
        <Input
          id="email"
          type="email"
          value={form.email}
          onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
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
          id="ageConfirmed"
          checked={form.ageConfirmed}
          onCheckedChange={(checked) =>
            setForm((f) => ({ ...f, ageConfirmed: checked === true }))
          }
        />
        <Label
          htmlFor="ageConfirmed"
          className="text-xs font-normal leading-snug text-muted-foreground"
        >
          Confirmo que soy mayor de edad (18 años o más).
        </Label>
      </div>

      <div className="flex items-start gap-2">
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
        {isPending ? 'Registrando…' : 'Registrarme ahora'}
      </Button>
    </form>
  )
}