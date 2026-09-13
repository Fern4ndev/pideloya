'use client'

import { useMemo, useState, useTransition, type SubmitEvent } from 'react'
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

const EMPTY_TOUCHED = {
  restaurantName: false,
  foodType: false,
  addressText: false,
  whatsapp: false,
  ownerPhone: false,
  ownerFullName: false,
  ownerEmail: false,
  password: false,
  consent: false,
}

const NAME_REGEX = /^[A-Za-zÀ-ÖØ-öø-ÿÑñ'’.\- ]{3,60}$/
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PASSWORD_REGEX = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/
const PHONE_REGEX = /^9\d{8}$/
type FormState = typeof EMPTY_FORM
type FieldName = keyof FormState
const VISIBLE_VALIDATION_FIELDS: FieldName[] = [
  'restaurantName',
  'foodType',
  'addressText',
  'whatsapp',
  'ownerPhone',
  'ownerFullName',
  'ownerEmail',
  'password',
]

function getFieldError(field: FieldName, form: FormState): string | null {
  switch (field) {
    case 'restaurantName':
      return form.restaurantName.trim().length >= 2
        ? null
        : 'Ingresa el nombre del restaurante'
    case 'foodType':
      return form.foodType ? null : 'Selecciona un tipo de comida'
    case 'addressText':
      return form.addressText.trim().length >= 5
        ? null
        : 'Ingresa una dirección válida'
    case 'whatsapp':
      return PHONE_REGEX.test(form.whatsapp)
        ? null
        : 'Debe tener 9 dígitos y empezar con 9'
    case 'ownerPhone':
      return PHONE_REGEX.test(form.ownerPhone)
        ? null
        : 'Debe tener 9 dígitos y empezar con 9'
    case 'ownerFullName': {
      const value = form.ownerFullName.trim()
      if (!value) return 'Ingresa el nombre del responsable'
      if (!NAME_REGEX.test(value)) return 'Solo letras y espacios'
      if (value.split(/\s+/).length < 2) return 'Ingresa nombre y apellido'
      return null
    }
    case 'ownerEmail':
      return EMAIL_REGEX.test(form.ownerEmail) ? null : 'Ingresa un correo válido'
    case 'password':
      return PASSWORD_REGEX.test(form.password)
        ? null
        : 'Mínimo 8 caracteres, con letras y números'
    case 'consent':
      return form.consent ? null : 'Debes autorizar el tratamiento de tus datos'
    default:
      return null
  }
}

const FIELD_ORDER: FieldName[] = [...VISIBLE_VALIDATION_FIELDS, 'consent']

function FieldError({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <p className="flex items-center gap-1 text-[11px] font-medium text-destructive">
      <Icon icon="lucide:alert-circle" width="11" height="11" className="shrink-0" />
      {message}
    </p>
  )
}

export function RestaurantRegisterForm() {
  const [form, setForm] = useState(EMPTY_FORM)
  const [touched, setTouched] = useState(EMPTY_TOUCHED)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [isPending, startTransition] = useTransition()

  const errors = useMemo(() => {
    const result = {} as Record<FieldName, string | null>
    for (const field of FIELD_ORDER) {
      result[field] = getFieldError(field, form)
    }
    return result
  }, [form])

  const isFormValid = FIELD_ORDER.every((field) => errors[field] === null)

  function markTouched(field: FieldName) {
    setTouched((t) => ({ ...t, [field]: true }))
  }

  function markAllTouched() {
    setTouched({
      restaurantName: true,
      foodType: true,
      addressText: true,
      whatsapp: true,
      ownerPhone: true,
      ownerFullName: true,
      ownerEmail: true,
      password: true,
      consent: true,
    })
  }

  function handleSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    if (!isFormValid) {
      markAllTouched()
      setError('Revisa los campos marcados antes de continuar.')
      return
    }

    startTransition(async () => {
      try {
        await registerRestaurant(form)
        setForm(EMPTY_FORM)
        setTouched(EMPTY_TOUCHED)
        setSuccess(true)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Algo salió mal')
      }
    })
  }

  if (success) {
    return (
      <div className="join-form relative overflow-hidden rounded-[28px] border border-zinc-800/80 bg-zinc-950/80 p-12 text-center shadow-glow backdrop-blur-xl">
        <div className="absolute top-0 right-0 w-40 h-40 bg-brand-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-orange-500/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />
        <div className="relative">
          <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-linear-to-br from-brand-400 to-brand-600 flex items-center justify-center shadow-xl shadow-brand-500/30 rotate-3 hover:rotate-0 transition-transform duration-300">
            <Icon icon="lucide:check" width="36" height="36" className="text-white" />
          </div>
          <h3 className="text-2xl font-bold mb-3">¡Listo! Registramos tu negocio</h3>
          <p className="mx-auto max-w-sm leading-relaxed text-zinc-400">
            Vamos a revisar tu información y activar tu cuenta. Te contactaremos por WhatsApp al número que registraste.
          </p>
          <div className="mt-8 inline-flex items-center gap-2 rounded-full bg-yellow-400/10 px-4 py-2 text-sm font-medium text-yellow-300">
            <Icon icon="lucide:clock" width="14" height="14" />
            Respuesta en menos de 24 horas
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="join-form relative overflow-hidden rounded-[28px] border border-zinc-800/80 bg-zinc-950/80 text-white shadow-glow backdrop-blur-xl">
      <div className="absolute top-0 inset-x-0 h-1 bg-linear-to-r from-brand-400 via-brand-500 to-orange-500" />

      <div className="border-b border-zinc-800/80 px-6 pb-5 pt-6">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-linear-to-br from-brand-500 to-brand-600 flex items-center justify-center shadow-lg shadow-brand-500/25 shrink-0">
            <Icon icon="lucide:store" width="22" height="22" className="text-white" />
          </div>
          <div>
            <h3 className="text-lg font-bold leading-tight">Registra tu negocio</h3>
            <p className="mt-0.5 text-xs text-zinc-400">Llega a más clientes en Abancay</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} noValidate className="p-6 space-y-5">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-md bg-brand-500/10 flex items-center justify-center shrink-0">
              <Icon icon="lucide:building-2" width="12" height="12" className="text-brand-600" />
            </div>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-300">Datos del negocio</h4>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="restaurantName" className="text-sm font-medium">
                Nombre del restaurante <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <Icon icon="lucide:store" width="14" height="14" className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/60" />
                <Input
                  id="restaurantName"
                  value={form.restaurantName}
                  onChange={(e) => setForm((f) => ({ ...f, restaurantName: e.target.value }))}
                  onBlur={() => markTouched('restaurantName')}
                  placeholder="Mi restaurante"
                  aria-invalid={touched.restaurantName && !!errors.restaurantName}
                  className="h-10 w-full pl-9 rounded-xl bg-muted/40 border-border/60 focus:border-brand-500 focus:ring-brand-500/20 transition-all"
                />
              </div>
              {touched.restaurantName && <FieldError message={errors.restaurantName} />}
            </div>

            <div className="space-y-1">
              <Label htmlFor="foodType" className="text-sm font-medium">
                Tipo de comida <span className="text-destructive">*</span>
              </Label>
              <Select
                value={form.foodType}
                onValueChange={(value) => {
                  setForm((f) => ({ ...f, foodType: value ?? '' }))
                  markTouched('foodType')
                }}
              >
                <SelectTrigger
                  id="foodType"
                  aria-invalid={touched.foodType && !!errors.foodType}
                  className="h-10 rounded-xl bg-muted/40 border-border/60 focus:border-brand-500 focus:ring-brand-500/20 transition-all"
                >
                  <SelectValue placeholder="Selecciona una opción" />
                </SelectTrigger>
                <SelectContent>
                  {FOOD_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>{type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {touched.foodType && <FieldError message={errors.foodType} />}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
            <Label htmlFor="addressText" className="text-sm font-medium">
              Dirección del restaurante <span className="text-destructive">*</span>
            </Label>
            <div className="relative">
              <Icon icon="lucide:map-pin" width="14" height="14" className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/60" />
              <Input
                id="addressText"
                value={form.addressText}
                onChange={(e) => setForm((f) => ({ ...f, addressText: e.target.value }))}
                onBlur={() => markTouched('addressText')}
                placeholder="Av. Arenas 123, Abancay"
                aria-invalid={touched.addressText && !!errors.addressText}
                className="h-10 w-full pl-9 rounded-xl bg-muted/40 border-border/60 focus:border-brand-500 focus:ring-brand-500/20 transition-all"
              />
            </div>
            {touched.addressText && <FieldError message={errors.addressText} />}
            </div>

            <div className="space-y-1">
              <div className="flex items-baseline justify-between">
                <Label htmlFor="whatsapp" className="text-sm font-medium">
                  WhatsApp del negocio <span className="text-destructive">*</span>
                </Label>
                <span className="text-[11px] tabular-nums text-muted-foreground/70">
                  {form.whatsapp.length}/9
                </span>
              </div>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground/60">+51</span>
                <Input
                  id="whatsapp"
                  inputMode="numeric"
                  value={form.whatsapp}
                  onChange={(e) => {
                    const digits = e.target.value.replace(/\D/g, '').slice(0, 9)
                    setForm((f) => ({ ...f, whatsapp: digits }))
                  }}
                  onBlur={() => markTouched('whatsapp')}
                  placeholder="987654321"
                  aria-invalid={touched.whatsapp && !!errors.whatsapp}
                  className="h-10 w-full pl-12 rounded-xl bg-muted/40 border-border/60 focus:border-brand-500 focus:ring-brand-500/20 transition-all"
                />
              </div>
              {touched.whatsapp && <FieldError message={errors.whatsapp} />}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-border/50" />
          <span className="text-[11px] font-medium uppercase tracking-widest text-zinc-500">Contacto</span>
          <div className="flex-1 h-px bg-border/50" />
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-md bg-brand-500/10 flex items-center justify-center shrink-0">
              <Icon icon="lucide:users" width="12" height="12" className="text-brand-600" />
            </div>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-300">Datos de contacto</h4>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="ownerFullName" className="text-sm font-medium">
                Nombre del responsable <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <Icon icon="lucide:user" width="14" height="14" className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/60" />
                <Input
                  id="ownerFullName"
                  value={form.ownerFullName}
                  onChange={(e) => setForm((f) => ({ ...f, ownerFullName: e.target.value }))}
                  onBlur={() => markTouched('ownerFullName')}
                  placeholder="Juan Pérez"
                  aria-invalid={touched.ownerFullName && !!errors.ownerFullName}
                  className="h-10 w-full pl-9 rounded-xl bg-muted/40 border-border/60 focus:border-brand-500 focus:ring-brand-500/20 transition-all"
                />
              </div>
              {touched.ownerFullName && <FieldError message={errors.ownerFullName} />}
            </div>
            <div className="space-y-1">
              <div className="flex items-baseline justify-between">
                <Label htmlFor="ownerPhone" className="text-sm font-medium">
                  Celular del responsable <span className="text-destructive">*</span>
                </Label>
                <span className="text-[11px] tabular-nums text-muted-foreground/70">
                  {form.ownerPhone.length}/9
                </span>
              </div>
              <div className="relative">
                <Icon icon="lucide:phone" width="14" height="14" className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/60" />
                <Input
                  id="ownerPhone"
                  inputMode="numeric"
                  value={form.ownerPhone}
                  onChange={(e) => {
                    const digits = e.target.value.replace(/\D/g, '').slice(0, 9)
                    setForm((f) => ({ ...f, ownerPhone: digits }))
                  }}
                  onBlur={() => markTouched('ownerPhone')}
                  placeholder="987654321"
                  aria-invalid={touched.ownerPhone && !!errors.ownerPhone}
                  className="h-10 w-full pl-9 rounded-xl bg-muted/40 border-border/60 focus:border-brand-500 focus:ring-brand-500/20 transition-all"
                />
              </div>
              {touched.ownerPhone && <FieldError message={errors.ownerPhone} />}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="ownerEmail" className="text-sm font-medium">
                E-mail del responsable <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <Icon icon="lucide:mail" width="14" height="14" className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/60" />
                <Input
                  id="ownerEmail"
                  type="email"
                  value={form.ownerEmail}
                  onChange={(e) => setForm((f) => ({ ...f, ownerEmail: e.target.value }))}
                  onBlur={() => markTouched('ownerEmail')}
                  placeholder="correo@ejemplo.com"
                  aria-invalid={touched.ownerEmail && !!errors.ownerEmail}
                  className="h-10 w-full pl-9 rounded-xl bg-muted/40 border-border/60 focus:border-brand-500 focus:ring-brand-500/20 transition-all"
                />
              </div>
              {touched.ownerEmail && <FieldError message={errors.ownerEmail} />}
            </div>
            <div className="space-y-1">
              <Label htmlFor="restPassword" className="text-sm font-medium">
                Crea una contraseña <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <Icon icon="lucide:lock" width="14" height="14" className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/60" />
                <Input
                  id="restPassword"
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  onBlur={() => markTouched('password')}
                  placeholder="••••••••"
                  aria-invalid={touched.password && !!errors.password}
                  className="h-10 w-full pl-9 pr-10 rounded-xl bg-muted/40 border-border/60 focus:border-brand-500 focus:ring-brand-500/20 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  tabIndex={-1}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/60 hover:text-foreground transition-colors"
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  <Icon icon={showPassword ? 'lucide:eye-off' : 'lucide:eye'} width="15" height="15" />
                </button>
              </div>
              {touched.password && <FieldError message={errors.password} />}
            </div>
          </div>
        </div>

        <div className="flex items-start gap-3 rounded-xl border border-zinc-800 bg-zinc-900/70 p-3">
          <Checkbox
            id="consent"
            checked={form.consent}
            onCheckedChange={(checked) => setForm((f) => ({ ...f, consent: checked === true }))}
            className="mt-0.5 data-[state=checked]:border-yellow-400 data-[state=checked]:bg-yellow-400"
          />
          <Label htmlFor="consent" className="text-xs leading-relaxed text-muted-foreground cursor-pointer select-none w-full">
            Autorizo el tratamiento de mis datos personales para comunicaciones vía WhatsApp, conforme a la{' '}
            <a href="#" className="text-brand-600 font-medium hover:underline">Política de Privacidad</a> de PideloYa.
          </Label>
        </div>

        {error && (
          <div className="flex items-center gap-3 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
            <Icon icon="lucide:alert-circle" width="18" height="18" className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <Button
          type="submit"
          className="h-11 w-full rounded-xl bg-yellow-400 text-sm font-semibold text-black shadow-glowStrong transition-all duration-200 hover:bg-yellow-300 disabled:bg-zinc-800 disabled:text-zinc-500"
          disabled={isPending || !isFormValid}
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