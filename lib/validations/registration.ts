import { z } from 'zod'

// Celular peruano: 9 dígitos, empieza en 9 (ej. 987654321)
const peruMobileRegex = /^9\d{8}$/

// Mínimo 8 caracteres con al menos una letra y un número. MISMA regla que el
// PASSWORD_REGEX del cliente (components/features/registration/shared/
// registrationConfig.tsx): el mensaje de error debe coincidir en ambos lados.
const passwordSchema = z
  .string()
  .regex(/^(?=.*[A-Za-z])(?=.*\d).{8,}$/, 'Mínimo 8 caracteres, con letras y números')

export const restaurantRegistrationSchema = z.object({
  restaurantName: z.string().min(2, 'Nombre muy corto'),
  foodType: z.string().min(1, 'Selecciona un tipo de comida'),
  addressText: z.string().min(3, 'Ingresa una dirección'),
  whatsapp: z
    .string()
    .regex(peruMobileRegex, 'Ingresa un número válido (9 dígitos, ej. 987654321)'),
  ownerPhone: z
    .string()
    .regex(peruMobileRegex, 'Ingresa un número válido (9 dígitos)'),
  ownerFullName: z.string().min(2, 'Nombre muy corto'),
  ownerEmail: z.string().email('Correo inválido'),
  password: passwordSchema,
  // Token de Turnstile (solo exigido en servidor si TURNSTILE_SECRET_KEY está
  // configurada; ver lib/security/registration-guard.ts).
  turnstileToken: z.string().optional(),
  consent: z
    .boolean()
    .refine((v) => v === true, 'Debes aceptar el tratamiento de datos'),
})

export const deliveryRegistrationSchema = z.object({
  fullName: z.string().min(2, 'Nombre muy corto'),
  documentType: z.string().min(1, 'Selecciona un tipo de documento'),
  documentNumber: z.string().min(6, 'Número de documento inválido'),
  vehicleType: z.string().min(1, 'Selecciona una opción'),
  phone: z.string().regex(peruMobileRegex, 'Ingresa un número válido (9 dígitos)'),
  email: z.string().email('Correo inválido'),
  password: passwordSchema,
  turnstileToken: z.string().optional(),
  ageConfirmed: z
    .boolean()
    .refine((v) => v === true, 'Debes confirmar que eres mayor de edad'),
  consent: z
    .boolean()
    .refine((v) => v === true, 'Debes aceptar el tratamiento de datos'),
})

export type RestaurantRegistrationInput = z.infer<
  typeof restaurantRegistrationSchema
>
export type DeliveryRegistrationInput = z.infer<
  typeof deliveryRegistrationSchema
>