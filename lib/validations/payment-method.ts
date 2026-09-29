import { z } from 'zod'
import { PAYMENT_METHODS } from '@/lib/constants/payment-method'

/**
 * Método de pago elegido por el cliente, validado en el BORDE del sistema.
 *
 * Existe aunque la base tenga el CHECK `deliveries_payment_method_check` y la
 * función SQL valide lo mismo, y no es redundancia inútil: cada capa falla en un
 * lugar distinto. El CHECK protege la fila, la función SQL explica el rechazo a
 * quien llama a la RPC, y esto evita que un valor inventado llegue siquiera a la
 * red — con un mensaje en español que la UI puede mostrar tal cual.
 *
 * El mensaje no menciona el valor inválido a propósito: el cliente ve una
 * elección entre dos opciones, no un identificador.
 */
export const paymentMethodSchema = z.enum(PAYMENT_METHODS, 'Elige cómo quieres pagar')

export type PaymentMethodInput = z.infer<typeof paymentMethodSchema>
