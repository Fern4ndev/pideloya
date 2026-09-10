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
      <div className="relative rounded-3xl border border-brand-100 bg-gradient-to-br from-brand-50 via-white to-orange-50 p-12 text-center overflow-hidden">
        <div className="absolute top-0 right-0 w-40 h-40 bg-brand-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-orange-500/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />
        <div className="relative">
          <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center shadow-xl shadow-brand-500/30 rotate-3 hover:rotate-0 transition-transform duration-300">
            <Icon icon="lucide:check" width="36" height="36" className="text-white" />
          </div>
          <h3 className="text-2xl font-bold mb-3">¡Listo! Registramos tu negocio</h3>
          <p className="text-muted-foreground max-w-sm mx-auto leading-relaxed">
            Vamos a revisar tu información y activar tu cuenta. Te contactaremos por WhatsApp al número que registraste.
          </p>
          <div className="mt-8 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-brand-500/10 text-brand-600 text-sm font-medium">
            <Icon icon="lucide:clock" width="14" height="14" />
            Respuesta en menos de 24 horas
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="relative rounded-3xl border border-border/60 bg-white shadow-xl shadow-black/[0.03] overflow-hidden">
      <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-brand-400 via-brand-500 to-orange-500" />

      <div className="px-8 pt-8 pb-6 border-b border-border/50">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-600 flex items-center justify-center shadow-lg shadow-brand-500/25">
            <Icon icon="lucide:store" width="26" height="26" className="text-white" />
          </div>
          <div>
            <h3 className="text-xl font-bold">Registra tu negocio</h3>
            <p className="text-sm text-muted-foreground mt-0.5">Llega a más clientes en Abancay</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="p-8 space-y-6">
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-6 h-6 rounded-lg bg-brand-500/10 flex items-center justify-center">
              <Icon icon="lucide:building-2" width="14" height="14" className="text-brand-600" />
            </div>
            <h4 className="text-sm font-semibold text-foreground">Datos del negocio</h4>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="restaurantName" className="text-sm font-medium">
                Nombre del restaurante
              </Label>
              <div className="relative">
                <Icon icon="lucide:store" width="15" height="15" className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/60" />
                <Input
                  id="restaurantName"
                  value={form.restaurantName}
                  onChange={(e) => setForm((f) => ({ ...f, restaurantName: e.target.value }))}
                  placeholder="Mi restaurante"
                  className="h-11 pl-10 rounded-xl bg-muted/40 border-border/60 focus:border-brand-500 focus:ring-brand-500/20 transition-all"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="foodType" className="text-sm font-medium">
                Tipo de comida
              </Label>
              <Select
                value={form.foodType}
                onValueChange={(value) => setForm((f) => ({ ...f, foodType: value ?? '' }))}
              >
                <SelectTrigger id="foodType" className="h-11 rounded-xl bg-muted/40 border-border/60 focus:border-brand-500 focus:ring-brand-500/20 transition-all">
                  <SelectValue placeholder="Selecciona una opción" />
                </SelectTrigger>
                <SelectContent>
                  {FOOD_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>{type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="addressText" className="text-sm font-medium">
              Dirección del restaurante
            </Label>
            <div className="relative">
              <Icon icon="lucide:map-pin" width="15" height="15" className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/60" />
              <Input
                id="addressText"
                value={form.addressText}
                onChange={(e) => setForm((f) => ({ ...f, addressText: e.target.value }))}
                placeholder="Av. Arenas 123, Abancay"
                className="h-11 pl-10 rounded-xl bg-muted/40 border-border/60 focus:border-brand-500 focus:ring-brand-500/20 transition-all"
                required
              />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-border/50" />
          <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-widest">Contacto</span>
          <div className="flex-1 h-px bg-border/50" />
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-6 h-6 rounded-lg bg-brand-500/10 flex items-center justify-center">
              <Icon icon="lucide:users" width="14" height="14" className="text-brand-600" />
            </div>
            <h4 className="text-sm font-semibold text-foreground">Datos de contacto</h4>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="whatsapp" className="text-sm font-medium">
              WhatsApp del negocio
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground/60">+51</span>
              <Input
                id="whatsapp"
                inputMode="numeric"
                value={form.whatsapp}
                onChange={(e) => setForm((f) => ({ ...f, whatsapp: e.target.value }))}
                placeholder="987 654 321"
                className="h-11 pl-12 rounded-xl bg-muted/40 border-border/60 focus:border-brand-500 focus:ring-brand-500/20 transition-all"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="ownerFullName" className="text-sm font-medium">
                Nombre del responsable
              </Label>
              <div className="relative">
                <Icon icon="lucide:user" width="15" height="15" className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/60" />
                <Input
                  id="ownerFullName"
                  value={form.ownerFullName}
                  onChange={(e) => setForm((f) => ({ ...f, ownerFullName: e.target.value }))}
                  placeholder="Juan Pérez"
                  className="h-11 pl-10 rounded-xl bg-muted/40 border-border/60 focus:border-brand-500 focus:ring-brand-500/20 transition-all"
                  required
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ownerPhone" className="text-sm font-medium">
                Celular del responsable
              </Label>
              <div className="relative">
                <Icon icon="lucide:phone" width="15" height="15" className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/60" />
                <Input
                  id="ownerPhone"
                  inputMode="numeric"
                  value={form.ownerPhone}
                  onChange={(e) => setForm((f) => ({ ...f, ownerPhone: e.target.value }))}
                  placeholder="987 654 321"
                  className="h-11 pl-10 rounded-xl bg-muted/40 border-border/60 focus:border-brand-500 focus:ring-brand-500/20 transition-all"
                  required
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="ownerEmail" className="text-sm font-medium">
                E-mail del responsable
              </Label>
              <div className="relative">
                <Icon icon="lucide:mail" width="15" height="15" className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/60" />
                <Input
                  id="ownerEmail"
                  type="email"
                  value={form.ownerEmail}
                  onChange={(e) => setForm((f) => ({ ...f, ownerEmail: e.target.value }))}
                  placeholder="correo@ejemplo.com"
                  className="h-11 pl-10 rounded-xl bg-muted/40 border-border/60 focus:border-brand-500 focus:ring-brand-500/20 transition-all"
                  required
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="restPassword" className="text-sm font-medium">
                Crea una contraseña
              </Label>
              <div className="relative">
                <Icon icon="lucide:lock" width="15" height="15" className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/60" />
                <Input
                  id="restPassword"
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  placeholder="••••••••"
                  className="h-11 pl-10 rounded-xl bg-muted/40 border-border/60 focus:border-brand-500 focus:ring-brand-500/20 transition-all"
                  required
                />
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-start gap-3 p-4 rounded-xl bg-muted/30 border border-border/40">
          <Checkbox
            id="consent"
            checked={form.consent}
            onCheckedChange={(checked) => setForm((f) => ({ ...f, consent: checked === true }))}
            className="mt-0.5 data-[state=checked]:bg-brand-500 data-[state=checked]:border-brand-500"
          />
          <Label htmlFor="consent" className="text-xs leading-relaxed text-muted-foreground cursor-pointer select-none">
            Autorizo el tratamiento de mis datos personales para comunicaciones
            vía WhatsApp, conforme a la{' '}
            <a href="#" className="text-brand-600 font-medium hover:underline">Política de Privacidad</a> de PideloYa.
          </Label>
        </div>

        {error && (
          <div className="flex items-center gap-3 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
            <Icon icon="lucide:alert-circle" width="18" height="18" className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <Button
          type="submit"
          className="w-full h-12 rounded-xl bg-gradient-to-r from-brand-500 to-brand-600 hover:from-brand-600 hover:to-brand-700 text-white font-semibold text-sm shadow-lg shadow-brand-500/25 hover:shadow-xl hover:shadow-brand-500/30 transition-all duration-200"
          disabled={isPending}
        >
          {isPending ? (
            <span className="flex items-center gap-2">
              <Icon icon="lucide:loader-2" width="16" height="16" className="animate-spin" />
              Registrando…
            </span>
          ) : (
            <span className="flex items-center gap-2">
              Registrar restaurante
              <Icon icon="lucide:arrow-right" width="16" height="16" />
            </span>
          )}
        </Button>

        <p className="text-xs text-center text-muted-foreground">
          Al registrar aceptas nuestros{' '}
          <a href="#" className="text-brand-600 font-medium hover:underline">Términos</a>
          {' '}y{' '}
          <a href="#" className="text-brand-600 font-medium hover:underline">Privacidad</a>
        </p>
      </form>
    </div>
  )
}
