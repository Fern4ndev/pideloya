'use client'

import { registerRestaurant } from '@/lib/actions/registration'
import { registerDeliveryPerson } from '@/lib/actions/registration'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type FieldDef =
  | { name: string; type: 'text'; label: string; placeholder?: string; inputMode?: 'text' | 'numeric'; maxLength?: number; counter?: boolean }
  | { name: string; type: 'email'; label: string; placeholder?: string }
  | { name: string; type: 'phone'; label: string; placeholder?: string }
  | { name: string; type: 'password'; label: string }
  | { name: string; type: 'select'; label: string; options: string[]; placeholder?: string }
  | { name: string; type: 'checkbox'; label: React.ReactNode }

export interface RegistrationConfig {
  title: string
  subtitle: string
  submitLabel: string
  loadingLabel: string
  fields: FieldDef[]
  fieldOrder: string[]
  validate: (field: string, form: Record<string, string | boolean>) => string | null
  onSubmit: (form: Record<string, string | boolean>) => Promise<unknown>
  successTitle: string
  successDescription: string
}

// ---------------------------------------------------------------------------
// Shared validation helpers
// ---------------------------------------------------------------------------

const NAME_REGEX = /^[A-Za-zÀ-ÖØ-öø-ÿÑñ''.\- ]{3,60}$/
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PASSWORD_REGEX = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/
const PHONE_REGEX = /^9\d{8}$/

function validatePhone(value: string): string | null {
  return PHONE_REGEX.test(value) ? null : 'Debe tener 9 dígitos y empezar con 9'
}

function validateEmail(value: string): string | null {
  return EMAIL_REGEX.test(value) ? null : 'Ingresa un correo válido'
}

function validatePassword(value: string): string | null {
  return PASSWORD_REGEX.test(value)
    ? null
    : 'Mínimo 8 caracteres, con letras y números'
}

function validateName(value: string, minLen = 2): string | null {
  const trimmed = value.trim()
  if (!trimmed) return 'Ingresa un nombre'
  if (!NAME_REGEX.test(trimmed)) return 'Solo letras y espacios'
  if (trimmed.split(/\s+/).length < 2) return 'Ingresa nombre y apellido'
  return null
}

// ---------------------------------------------------------------------------
// Delivery config
// ---------------------------------------------------------------------------

const DELIVERY_FIELDS: FieldDef[] = [
  { name: 'fullName', type: 'text', label: 'Nombre completo', placeholder: 'Juan Pérez' },
  { name: 'documentType', type: 'select', label: 'Tipo de documento', options: ['DNI', 'Carné de extranjería', 'Pasaporte'] },
  { name: 'documentNumber', type: 'text', label: 'N.º de documento', placeholder: 'N.º documento' },
  { name: 'vehicleType', type: 'select', label: '¿Cómo vas a repartir?', options: ['Moto', 'Mototaxi', 'Bicicleta', 'A pie', 'Auto'] },
  { name: 'phone', type: 'phone', label: 'Celular' },
  { name: 'email', type: 'email', label: 'E-mail' },
  { name: 'password', type: 'password', label: 'Crea una contraseña' },
  { name: 'ageConfirmed', type: 'checkbox', label: 'Confirmo que soy mayor de edad (18 años o más).' },
  { name: 'consent', type: 'checkbox', label: (
    <>
      Autorizo el tratamiento de mis datos personales para comunicaciones vía
      WhatsApp, conforme a la{' '}
      <a href="#" className="text-zinc-300 underline underline-offset-2 hover:text-white">
        Política de Privacidad
      </a>{' '}
      de PideloYa.
    </>
  )},
]

function validateDelivery(field: string, form: Record<string, string | boolean>): string | null {
  switch (field) {
    case 'fullName':
      return validateName(form.fullName as string)
    case 'documentType':
      return form.documentType ? null : 'Selecciona un tipo de documento'
    case 'documentNumber': {
      const val = (form.documentNumber as string) ?? ''
      if (!val) return 'Ingresa tu número de documento'
      if (form.documentType === 'DNI' && !/^\d{8}$/.test(val)) return 'El DNI debe tener 8 dígitos numéricos'
      if (form.documentType !== 'DNI' && val.trim().length < 6) return 'Ingresa un número de documento válido'
      return null
    }
    case 'vehicleType':
      return form.vehicleType ? null : 'Selecciona cómo vas a repartir'
    case 'phone':
      return validatePhone(form.phone as string)
    case 'email':
      return validateEmail(form.email as string)
    case 'password':
      return validatePassword(form.password as string)
    case 'ageConfirmed':
      return form.ageConfirmed ? null : 'Debes confirmar que eres mayor de edad'
    case 'consent':
      return form.consent ? null : 'Debes autorizar el tratamiento de tus datos'
    default:
      return null
  }
}

export const deliveryConfig: RegistrationConfig = {
  title: 'Conviértete en repartidor',
  subtitle: 'Gana dinero a tu ritmo en Abancay',
  submitLabel: 'Registrarme ahora',
  loadingLabel: 'Registrando…',
  fields: DELIVERY_FIELDS,
  fieldOrder: DELIVERY_FIELDS.map((f) => f.name),
  validate: validateDelivery,
  onSubmit: (form) => registerDeliveryPerson(form as any),
  successTitle: 'Recibimos tu registro',
  successDescription:
    'Vamos a validar tus datos y activar tu cuenta. Te contactaremos por WhatsApp.',
}

// ---------------------------------------------------------------------------
// Restaurant config
// ---------------------------------------------------------------------------

const RESTAURANT_FIELDS: FieldDef[] = [
  { name: 'restaurantName', type: 'text', label: 'Nombre del restaurante', placeholder: 'Mi restaurante' },
  { name: 'foodType', type: 'select', label: 'Tipo de comida', options: ['Pollería', 'Comida rápida', 'Menú / Comida criolla', 'Pizzería', 'Chifa', 'Postres y dulces', 'Otro'] },
  { name: 'addressText', type: 'text', label: 'Dirección del restaurante', placeholder: 'Av. Arenas 123, Abancay' },
  { name: 'whatsapp', type: 'phone', label: 'WhatsApp del negocio' },
  { name: 'ownerFullName', type: 'text', label: 'Nombre del responsable', placeholder: 'Juan Pérez' },
  { name: 'ownerPhone', type: 'phone', label: 'Celular del responsable' },
  { name: 'ownerEmail', type: 'email', label: 'E-mail del responsable' },
  { name: 'password', type: 'password', label: 'Crea una contraseña' },
  { name: 'consent', type: 'checkbox', label: (
    <>
      Autorizo el tratamiento de mis datos personales para comunicaciones vía
      WhatsApp, conforme a la{' '}
      <a href="#" className="text-zinc-300 underline underline-offset-2 hover:text-white">
        Política de Privacidad
      </a>{' '}
      de PideloYa.
    </>
  )},
]

function validateRestaurant(field: string, form: Record<string, string | boolean>): string | null {
  switch (field) {
    case 'restaurantName':
      return (form.restaurantName as string).trim().length >= 2
        ? null
        : 'Ingresa el nombre del restaurante'
    case 'foodType':
      return form.foodType ? null : 'Selecciona un tipo de comida'
    case 'addressText':
      return (form.addressText as string).trim().length >= 5
        ? null
        : 'Ingresa una dirección válida'
    case 'whatsapp':
      return validatePhone(form.whatsapp as string)
    case 'ownerFullName':
      return validateName(form.ownerFullName as string)
    case 'ownerPhone':
      return validatePhone(form.ownerPhone as string)
    case 'ownerEmail':
      return validateEmail(form.ownerEmail as string)
    case 'password':
      return validatePassword(form.password as string)
    case 'consent':
      return form.consent ? null : 'Debes autorizar el tratamiento de tus datos'
    default:
      return null
  }
}

export const restaurantConfig: RegistrationConfig = {
  title: 'Registra tu negocio',
  subtitle: 'Llega a más clientes en Abancay',
  submitLabel: 'Registrar restaurante',
  loadingLabel: 'Registrando…',
  fields: RESTAURANT_FIELDS,
  fieldOrder: RESTAURANT_FIELDS.map((f) => f.name),
  validate: validateRestaurant,
  onSubmit: (form) => registerRestaurant(form as any),
  successTitle: 'Registramos tu negocio',
  successDescription:
    'Vamos a revisar tu información y activar tu cuenta. Te contactaremos por WhatsApp al número que registraste.',
}
