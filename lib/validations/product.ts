import { z } from 'zod'

export const productSchema = z.object({
  name: z.string().min(2, 'Nombre muy corto'),
  description: z.string().optional(),
  price: z.coerce.number().positive('El precio debe ser mayor a 0'),
  imageUrl: z
    .string()
    .url('URL de imagen inválida')
    .optional()
    .or(z.literal('')),
  imageFileId: z.string().optional().or(z.literal('')),
  available: z.boolean(),
  categoryId: z.string().uuid().optional().or(z.literal('')),
})

export type ProductInput = z.infer<typeof productSchema>