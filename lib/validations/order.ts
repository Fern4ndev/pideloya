import { z } from 'zod'

export const createOrderSchema = z.object({
  addressId: z.string().uuid('Selecciona una dirección'),
  // Idempotencia: uuid que genera el navegador al confirmar (crypto.randomUUID).
  // Un reintento o doble clic con el MISMO id devuelve el pedido ya creado
  // (unique index (customer_id, client_request_id) + RPC create_order).
  clientRequestId: z.string().uuid('Identificador de pedido inválido'),
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
