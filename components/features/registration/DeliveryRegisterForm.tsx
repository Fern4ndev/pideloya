'use client'

import { useMemo, useState, useTransition, type SubmitEvent } from 'react'
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

const EMPTY_TOUCHED = {
  fullName: false,
  documentType: false,
  documentNumber: false,
  vehicleType: false,
  phone: false,
  email: false,
  password: false,
  ageConfirmed: false,
  consent: false,
}

const NAME_REGEX = /^[A-Za-zÀ-ÖØ-öø-ÿÑñ'’.\- ]{3,30}$/
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
// Mínimo 8 caracteres, con al menos una letra y un número.
const PASSWORD_REGEX = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/

type FormState = typeof EMPTY_FORM
type FieldName = keyof FormState

function getFieldError(field: FieldName, form: FormState): string | null {
  switch (field) {
    case 'fullName': {
      const value = form.fullName.trim()
      if (!value) return 'Ingresa tu nombre completo'
      if (!NAME_REGEX.test(value)) return 'Solo letras y espacios'
      if (value.split(/\s+/).length < 2) return 'Ingresa nombre y apellido'
      return null
    }
    case 'documentType':
      return form.documentType ? null : 'Selecciona un tipo de documento'
    case 'documentNumber': {
      if (!form.documentNumber) return 'Ingresa tu número de documento'
      if (form.documentType === 'DNI' && !/^\d{8}$/.test(form.documentNumber)) {
        return 'El DNI debe tener 8 dígitos numéricos'
      }
      if (form.documentType !== 'DNI' && form.documentNumber.trim().length < 6) {
        return 'Ingresa un número de documento válido'
      }
      return null
    }
    case 'vehicleType':
      return form.vehicleType ? null : 'Selecciona cómo vas a repartir'
    case 'phone':
      return /^9\d{8}$/.test(form.phone)
        ? null
        : 'Debe tener 9 dígitos y empezar con 9'
    case 'email':
      return EMAIL_REGEX.test(form.email) ? null : 'Ingresa un correo válido'
    case 'password':
      return PASSWORD_REGEX.test(form.password)
        ? null
        : 'Mínimo 8 caracteres, con letras y números'
    case 'ageConfirmed':
      return form.ageConfirmed ? null : 'Debes confirmar que eres mayor de edad'
    case 'consent':
      return form.consent ? null : 'Debes autorizar el tratamiento de tus datos'
    default:
      return null
  }
}

const FIELD_ORDER: FieldName[] = [
  'fullName',
  'documentType',
  'documentNumber',
  'vehicleType',
  'phone',
  'email',
  'password',
  'ageConfirmed',
  'consent',
]

function FieldError({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <p className="flex items-center gap-1 text-[11px] font-medium text-destructive">
      <Icon icon="lucide:alert-circle" width="11" height="11" className="shrink-0" />
      {message}
    </p>
  )
}

export function DeliveryRegisterForm() {
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
      fullName: true,
      documentType: true,
      documentNumber: true,
      vehicleType: true,
      phone: true,
      email: true,
      password: true,
      ageConfirmed: true,
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
        await registerDeliveryPerson(form)
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

      <div className="px-6 pt-6 pb-5 border-b border-border/50">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-500/25 shrink-0">
            <Icon icon="lucide:zap" width="22" height="22" className="text-white" />
          </div>
          <div>
            <h3 className="text-lg font-bold leading-tight">Conviértete en repartidor</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Gana dinero a tu ritmo en Abancay</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} noValidate className="p-6 space-y-5">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-md bg-emerald-500/10 flex items-center justify-center shrink-0">
              <Icon icon="lucide:user" width="12" height="12" className="text-emerald-600" />
            </div>
            <h4 className="text-xs font-semibold text-foreground uppercase tracking-wide">Datos personales</h4>
          </div>

          <div className="space-y-1">
            <Label htmlFor="fullName" className="text-sm font-medium">
              Nombre completo <span className="text-destructive">*</span>
            </Label>
            <div className="relative">
              <Icon icon="lucide:user" width="14" height="14" className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/60" />
              <Input
                id="fullName"
                value={form.fullName}
                onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
                onBlur={() => markTouched('fullName')}
                placeholder="Juan Pérez"
                aria-invalid={touched.fullName && !!errors.fullName}
                className="h-10 pl-9 rounded-xl bg-muted/40 border-border/60 focus:border-emerald-500 focus:ring-emerald-500/20 transition-all"
              />
            </div>
            {touched.fullName && <FieldError message={errors.fullName} />}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="documentType" className="text-sm font-medium">
                Tipo doc. <span className="text-destructive">*</span>
              </Label>
              <Select
                value={form.documentType}
                onValueChange={(value) => {
                  setForm((f) => ({ ...f, documentType: value ?? '' }))
                  markTouched('documentType')
                }}
              >
                <SelectTrigger
                  id="documentType"
                  aria-invalid={touched.documentType && !!errors.documentType}
                  className="h-10 rounded-xl bg-muted/40 border-border/60 focus:border-emerald-500 focus:ring-emerald-500/20 transition-all"
                >
                  <SelectValue placeholder="Selecciona" />
                </SelectTrigger>
                <SelectContent>
                  {DOCUMENT_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>{type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {touched.documentType && <FieldError message={errors.documentType} />}
            </div>
            <div className="space-y-1">
              <div className="flex items-baseline justify-between">
                <Label htmlFor="documentNumber" className="text-sm font-medium">
                  N° documento <span className="text-destructive">*</span>
                </Label>
                {form.documentType === 'DNI' && (
                  <span className="text-[11px] tabular-nums text-muted-foreground/70">
                    {form.documentNumber.length}/8
                  </span>
                )}
              </div>
              <div className="relative">
                <Icon icon="lucide:credit-card" width="14" height="14" className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/60" />
                <Input
                  id="documentNumber"
                  inputMode={form.documentType === 'DNI' ? 'numeric' : 'text'}
                  value={form.documentNumber}
                  onChange={(e) => {
                    const raw = e.target.value
                    const next =
                      form.documentType === 'DNI'
                        ? raw.replace(/\D/g, '').slice(0, 8)
                        : raw.slice(0, 15)
                    setForm((f) => ({ ...f, documentNumber: next }))
                  }}
                  onBlur={() => markTouched('documentNumber')}
                  placeholder={form.documentType === 'DNI' ? '12345678' : 'N° documento'}
                  aria-invalid={touched.documentNumber && !!errors.documentNumber}
                  className="h-10 pl-9 rounded-xl bg-muted/40 border-border/60 focus:border-emerald-500 focus:ring-emerald-500/20 transition-all"
                />
              </div>
              {touched.documentNumber && <FieldError message={errors.documentNumber} />}
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="vehicleType" className="text-sm font-medium">
              ¿Cómo vas a repartir? <span className="text-destructive">*</span>
            </Label>
            <Select
              value={form.vehicleType}
              onValueChange={(value) => {
                setForm((f) => ({ ...f, vehicleType: value ?? '' }))
                markTouched('vehicleType')
              }}
            >
              <SelectTrigger
                id="vehicleType"
                aria-invalid={touched.vehicleType && !!errors.vehicleType}
                className="h-10 rounded-xl bg-muted/40 border-border/60 focus:border-emerald-500 focus:ring-emerald-500/20 transition-all"
              >
                <SelectValue placeholder="Selecciona una opción" />
              </SelectTrigger>
              <SelectContent>
                {VEHICLE_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>{type}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {touched.vehicleType && <FieldError message={errors.vehicleType} />}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-border/50" />
          <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-widest">Contacto</span>
          <div className="flex-1 h-px bg-border/50" />
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-md bg-emerald-500/10 flex items-center justify-center shrink-0">
              <Icon icon="lucide:smartphone" width="12" height="12" className="text-emerald-600" />
            </div>
            <h4 className="text-xs font-semibold text-foreground uppercase tracking-wide">Datos de contacto</h4>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <div className="flex items-baseline justify-between">
                <Label htmlFor="phone" className="text-sm font-medium">
                  Celular <span className="text-destructive">*</span>
                </Label>
                <span className="text-[11px] tabular-nums text-muted-foreground/70">
                  {form.phone.length}/9
                </span>
              </div>
              <div className="relative">
                <Icon icon="lucide:smartphone" width="14" height="14" className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/60" />
                <Input
                  id="phone"
                  inputMode="numeric"
                  value={form.phone}
                  onChange={(e) => {
                    const digits = e.target.value.replace(/\D/g, '').slice(0, 9)
                    setForm((f) => ({ ...f, phone: digits }))
                  }}
                  onBlur={() => markTouched('phone')}
                  placeholder="987654321"
                  aria-invalid={touched.phone && !!errors.phone}
                  className="h-10 pl-9 rounded-xl bg-muted/40 border-border/60 focus:border-emerald-500 focus:ring-emerald-500/20 transition-all"
                />
              </div>
              {touched.phone && <FieldError message={errors.phone} />}
            </div>
            <div className="space-y-1">
              <Label htmlFor="email" className="text-sm font-medium">
                E-mail <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <Icon icon="lucide:mail" width="14" height="14" className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/60" />
                <Input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  onBlur={() => markTouched('email')}
                  placeholder="correo@ejemplo.com"
                  aria-invalid={touched.email && !!errors.email}
                  className="h-10 pl-9 rounded-xl bg-muted/40 border-border/60 focus:border-emerald-500 focus:ring-emerald-500/20 transition-all"
                />
              </div>
              {touched.email && <FieldError message={errors.email} />}
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="repPassword" className="text-sm font-medium">
              Crea una contraseña <span className="text-destructive">*</span>
            </Label>
            <div className="relative">
              <Icon icon="lucide:lock" width="14" height="14" className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/60" />
              <Input
                id="repPassword"
                type={showPassword ? 'text' : 'password'}
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                onBlur={() => markTouched('password')}
                placeholder="••••••••"
                aria-invalid={touched.password && !!errors.password}
                className="h-10 pl-9 pr-10 rounded-xl bg-muted/40 border-border/60 focus:border-emerald-500 focus:ring-emerald-500/20 transition-all"
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

        <div className="space-y-2">
          <div className="flex items-start gap-3 p-3 rounded-xl bg-muted/30 border border-border/40">
            <Checkbox
              id="ageConfirmed"
              checked={form.ageConfirmed}
              onCheckedChange={(checked) => {
                setForm((f) => ({ ...f, ageConfirmed: checked === true }))
                markTouched('ageConfirmed')
              }}
              className="mt-0.5 data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500"
            />
            <Label htmlFor="ageConfirmed" className="text-xs leading-relaxed text-muted-foreground cursor-pointer select-none">
              Confirmo que soy mayor de edad (18 años o más).
            </Label>
          </div>

          <div className="flex items-start gap-3 p-3 rounded-xl bg-muted/30 border border-border/40">
            <Checkbox
              id="consent"
              checked={form.consent}
              onCheckedChange={(checked) => {
                setForm((f) => ({ ...f, consent: checked === true }))
                markTouched('consent')
              }}
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
          <div className="flex items-center gap-3 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
            <Icon icon="lucide:alert-circle" width="18" height="18" className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <Button
          type="submit"
          className="w-full h-11 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-semibold text-sm shadow-lg shadow-emerald-500/25 hover:shadow-xl hover:shadow-emerald-500/30 transition-all duration-200 disabled:from-muted disabled:to-muted disabled:shadow-none disabled:text-muted-foreground"
          disabled={isPending || !isFormValid}
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