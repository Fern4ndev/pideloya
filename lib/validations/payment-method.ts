import { z } from 'zod'
import {
  PAYMENT_METHODS,
  PAYMENT_TIMINGS,
} from '@/lib/constants/payment-method'

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

/** El segundo eje de la elección (D2): cuándo paga. Mismo criterio de mensaje
 * mostrable tal cual en la UI. */
export const paymentTimingSchema = z.enum(
  PAYMENT_TIMINGS,
  'Elige cuándo quieres pagar'
)

export type PaymentTimingInput = z.infer<typeof paymentTimingSchema>

/**
 * La elección COMPLETA del cliente: método + momento, con el único cruce
 * imposible invalidado aquí (antes de salir a la red). La función SQL lo vuelve
 * a validar — defensa en profundidad, igual que el método — pero rechazarlo en
 * el borde evita un viaje de ida y vuelta y da un mensaje en español que la UI
 * muestra tal cual.
 */
export const paymentSelectionSchema = z
  .object({
    method: paymentMethodSchema,
    timing: paymentTimingSchema,
  })
  .refine((v) => !(v.method === 'CASH' && v.timing === 'UPFRONT'), {
    message: 'El efectivo solo se paga al recibir',
  })

export type PaymentSelectionInput = z.infer<typeof paymentSelectionSchema>
