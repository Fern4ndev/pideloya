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
      <div className="relative rounded-3xl border border-emerald-100 bg-gradient-to-br from-emerald-50 via-white to-teal-50 p-12 text-center overflow-hidden">
        <div className="absolute top-0 right-0 w-40 h-40 bg-emerald-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-teal-500/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />
        <div className="relative">
          <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shadow-xl shadow-emerald-500/30 -rotate-3 hover:rotate-0 transition-transform duration-300">
            <Icon icon="lucide:check" width="36" height="36" className="text-white" />
          </div>
          <h3 className="text-2xl font-bold mb-3">¡Listo! Recibimos tu registro</h3>
          <p className="text-muted-foreground max-w-sm mx-auto leading-relaxed">
            Vamos a validar tus datos y activar tu cuenta. Te contactaremos por WhatsApp.
          </p>
          <div className="mt-8 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 text-emerald-600 text-sm font-medium">
            <Icon icon="lucide:clock" width="14" height="14" />
            Respuesta en menos de 24 horas
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="relative rounded-3xl border border-border/60 bg-white shadow-xl shadow-black/[0.03] overflow-hidden">
      <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-emerald-400 via-emerald-500 to-teal-500" />

      <div className="px-8 pt-8 pb-6 border-b border-border/50">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-500/25">
            <Icon icon="lucide:zap" width="26" height="26" className="text-white" />
          </div>
          <div>
            <h3 className="text-xl font-bold">Conviértete en repartidor</h3>
            <p className="text-sm text-muted-foreground mt-0.5">Gana dinero a tu ritmo en Abancay</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="p-8 space-y-6">
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-6 h-6 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <Icon icon="lucide:user" width="14" height="14" className="text-emerald-600" />
            </div>
            <h4 className="text-sm font-semibold text-foreground">Datos personales</h4>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="fullName" className="text-sm font-medium">
              Nombre completo
            </Label>
            <div className="relative">
              <Icon icon="lucide:user" width="15" height="15" className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/60" />
              <Input
                id="fullName"
                value={form.fullName}
                onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
                placeholder="Juan Pérez"
                className="h-11 pl-10 rounded-xl bg-muted/40 border-border/60 focus:border-emerald-500 focus:ring-emerald-500/20 transition-all"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="documentType" className="text-sm font-medium">
                Tipo de documento
              </Label>
              <Select
                value={form.documentType}
                onValueChange={(value) => setForm((f) => ({ ...f, documentType: value ?? '' }))}
              >
                <SelectTrigger id="documentType" className="h-11 rounded-xl bg-muted/40 border-border/60 focus:border-emerald-500 focus:ring-emerald-500/20 transition-all">
                  <SelectValue placeholder="Selecciona" />
                </SelectTrigger>
                <SelectContent>
                  {DOCUMENT_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>{type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="documentNumber" className="text-sm font-medium">
                N° de documento
              </Label>
              <div className="relative">
                <Icon icon="lucide:credit-card" width="15" height="15" className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/60" />
                <Input
                  id="documentNumber"
                  value={form.documentNumber}
                  onChange={(e) => setForm((f) => ({ ...f, documentNumber: e.target.value }))}
                  placeholder="12345678"
                  className="h-11 pl-10 rounded-xl bg-muted/40 border-border/60 focus:border-emerald-500 focus:ring-emerald-500/20 transition-all"
                  required
                />
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="vehicleType" className="text-sm font-medium">
              ¿Cómo vas a repartir?
            </Label>
            <Select
              value={form.vehicleType}
              onValueChange={(value) => setForm((f) => ({ ...f, vehicleType: value ?? '' }))}
            >
              <SelectTrigger id="vehicleType" className="h-11 rounded-xl bg-muted/40 border-border/60 focus:border-emerald-500 focus:ring-emerald-500/20 transition-all">
                <SelectValue placeholder="Selecciona una opción" />
              </SelectTrigger>
              <SelectContent>
                {VEHICLE_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>{type}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-border/50" />
          <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-widest">Contacto</span>
          <div className="flex-1 h-px bg-border/50" />
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-6 h-6 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <Icon icon="lucide:smartphone" width="14" height="14" className="text-emerald-600" />
            </div>
            <h4 className="text-sm font-semibold text-foreground">Datos de contacto</h4>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="phone" className="text-sm font-medium">
                Celular (WhatsApp)
              </Label>
              <div className="relative">
                <Icon icon="lucide:smartphone" width="15" height="15" className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/60" />
                <Input
                  id="phone"
                  inputMode="numeric"
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  placeholder="987 654 321"
                  className="h-11 pl-10 rounded-xl bg-muted/40 border-border/60 focus:border-emerald-500 focus:ring-emerald-500/20 transition-all"
                  required
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-sm font-medium">
                E-mail
              </Label>
              <div className="relative">
                <Icon icon="lucide:mail" width="15" height="15" className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/60" />
                <Input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="correo@ejemplo.com"
                  className="h-11 pl-10 rounded-xl bg-muted/40 border-border/60 focus:border-emerald-500 focus:ring-emerald-500/20 transition-all"
                  required
                />
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="repPassword" className="text-sm font-medium">
              Crea una contraseña
            </Label>
            <div className="relative">
              <Icon icon="lucide:lock" width="15" height="15" className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/60" />
              <Input
                id="repPassword"
                type="password"
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                placeholder="••••••••"
                className="h-11 pl-10 rounded-xl bg-muted/40 border-border/60 focus:border-emerald-500 focus:ring-emerald-500/20 transition-all"
                required
              />
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-start gap-3 p-4 rounded-xl bg-muted/30 border border-border/40">
            <Checkbox
              id="ageConfirmed"
              checked={form.ageConfirmed}
              onCheckedChange={(checked) => setForm((f) => ({ ...f, ageConfirmed: checked === true }))}
              className="mt-0.5 data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500"
            />
            <Label htmlFor="ageConfirmed" className="text-xs leading-relaxed text-muted-foreground cursor-pointer select-none">
              Confirmo que soy mayor de edad (18 años o más).
            </Label>
          </div>

          <div className="flex items-start gap-3 p-4 rounded-xl bg-muted/30 border border-border/40">
            <Checkbox
              id="consent"
              checked={form.consent}
              onCheckedChange={(checked) => setForm((f) => ({ ...f, consent: checked === true }))}
              className="mt-0.5 data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500"
            />
            <Label htmlFor="consent" className="text-xs leading-relaxed text-muted-foreground cursor-pointer select-none">
              Autorizo el tratamiento de mis datos personales para comunicaciones
              vía WhatsApp, conforme a la{' '}
              <a href="#" className="text-emerald-600 font-medium hover:underline">Política de Privacidad</a> de PideloYa.
            </Label>
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-3 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
            <Icon icon="lucide:alert-circle" width="18" height="18" className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <Button
          type="submit"
          className="w-full h-12 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-semibold text-sm shadow-lg shadow-emerald-500/25 hover:shadow-xl hover:shadow-emerald-500/30 transition-all duration-200"
          disabled={isPending}
        >
          {isPending ? (
            <span className="flex items-center gap-2">
              <Icon icon="lucide:loader-2" width="16" height="16" className="animate-spin" />
              Registrando…
            </span>
          ) : (
            <span className="flex items-center gap-2">
              Registrarme ahora
              <Icon icon="lucide:arrow-right" width="16" height="16" />
            </span>
          )}
        </Button>

        <p className="text-xs text-center text-muted-foreground">
          Al registrar aceptas nuestros{' '}
          <a href="#" className="text-emerald-600 font-medium hover:underline">Términos</a>
          {' '}y{' '}
          <a href="#" className="text-emerald-600 font-medium hover:underline">Privacidad</a>
        </p>
      </form>
    </div>
  )
}
