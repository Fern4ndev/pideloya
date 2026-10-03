import { z } from 'zod'
import { PAYMENT_METHODS, PAYMENT_TIMINGS } from '@/lib/constants/payment-method'

/**
 * [LEGACY] Método de pago del envío ('YAPE' | 'CASH'), validado en el borde.
 *
 * Ya no se pregunta: la elección del cliente tiene un solo eje (`timing`) y el
 * medio dejó de guardarse. Se conserva porque la API v1 lo ACEPTA por
 * compatibilidad con las integraciones desplegadas, y sigue siendo el tipo que
 * estrecha los datos históricos que la UI lee (`toPaymentMethod`).
 */
export const paymentMethodSchema = z.enum(PAYMENT_METHODS, 'Elige cómo quieres pagar')

export type PaymentMethodInput = z.infer<typeof paymentMethodSchema>

/** El único eje de la elección: cuándo paga. Mismo criterio de mensaje
 * mostrable tal cual en la UI. */
export const paymentTimingSchema = z.enum(
  PAYMENT_TIMINGS,
  'Elige cuándo quieres pagar'
)

export type PaymentTimingInput = z.infer<typeof paymentTimingSchema>

/**
 * La elección del cliente: SOLO el momento. El método ya no forma parte de la
 * decisión (el repartidor cobra con lo que el cliente le entregue), y el cruce
 * imposible que antes se invalidaba acá (efectivo + pagar ahora) desapareció
 * con el eje: con UPFRONT el método es Yape por construcción.
 *
 * Existe aunque la base tenga el CHECK `deliveries_timing_method_check` y la
 * función SQL valide lo mismo, y no es redundancia inútil: cada capa falla en
 * un lugar distinto. El CHECK protege la fila, la función SQL explica el
 * rechazo a quien llama a la RPC, y esto evita que un valor inventado llegue
 * siquiera a la red — con un mensaje en español que la UI puede mostrar tal
 * cual.
 */
export const paymentSelectionSchema = z.object({
  timing: paymentTimingSchema,
})

export type PaymentSelectionInput = z.infer<typeof paymentSelectionSchema>
