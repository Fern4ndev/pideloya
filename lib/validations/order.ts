import { z } from 'zod'

export const createOrderSchema = z.object({
  addressId: z.string().uuid('Selecciona una dirección'),
  notes: z.string().optional(),
  items: z
    .array(
      z.object({
        productId: z.string().uuid(),
        quantity: z.number().int().positive(),
      })
    )
    .min(1, 'El carrito está vacío'),
})

export type CreateOrderInput = z.infer<typeof createOrderSchema>