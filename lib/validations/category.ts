import { z } from 'zod'

export const categorySchema = z.object({
  name: z.string().min(2, 'Nombre muy corto'),
})

export type CategoryInput = z.infer<typeof categorySchema>