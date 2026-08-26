import { z } from 'zod'

export const addressSchema = z.object({
  label: z.string().nullable().optional(),
  addressText: z.string().min(3, 'Ingresa una dirección'),
  reference: z.string().nullable().optional(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
})

export type AddressInput = z.infer<typeof addressSchema>