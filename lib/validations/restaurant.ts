import { z } from 'zod'

const peruMobileRegex = /^9\d{8}$/

export const restaurantSchema = z.object({
  name: z.string().min(2, 'Nombre muy corto'),
  description: z.string().optional().or(z.literal('')),
  addressText: z.string().min(3, 'Ingresa una dirección'),
  whatsapp: z
    .string()
    .regex(peruMobileRegex, 'Ingresa un número válido (9 dígitos, ej. 987654321)')
    .optional()
    .or(z.literal('')),
  foodType: z.string().min(1, 'Selecciona un tipo de comida'),
})

export const restaurantCreateSchema = restaurantSchema.extend({
  slug: z.string().optional(),
})

export type RestaurantInput = z.infer<typeof restaurantSchema>
export type RestaurantCreateInput = z.infer<typeof restaurantCreateSchema>