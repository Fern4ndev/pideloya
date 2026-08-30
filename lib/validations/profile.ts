import { z } from 'zod'

export const profileUpdateSchema = z.object({
  fullName: z.string().min(2, 'Nombre muy corto'),
  phone: z.string().optional().or(z.literal('')),
  documentType: z.string().nullable().optional(),
  documentNumber: z.string().nullable().optional(),
  vehicleType: z.string().nullable().optional(),
})

export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>