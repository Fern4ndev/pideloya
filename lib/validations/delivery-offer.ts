import { z } from 'zod'

/** Rango que acepta el SERVIDOR: protección de UX/negocio contra errores de
 * tecleo (S/ 0.01 o S/ 500), sin relación con la distancia. */
export const DELIVERY_FEE_MIN = 1
export const DELIVERY_FEE_MAX = 30

/**
 * Tarifa inicial que ve el repartidor al abrir el formulario de oferta.
 * Punto de partida fijo — no depende de la distancia — y el repartidor lo
 * cambia libremente antes de enviar la oferta.
 */
export const DEFAULT_DELIVERY_FEE = 5

/**
 * Tarifa de envío que el repartidor propone al cliente.
 *
 * `coerce` porque el input del formulario entrega un string
 * (`<input type="number">`): así el borde del sistema tolera ambos y la
 * validación no depende de quién llama.
 */
export const deliveryOfferSchema = z.object({
  deliveryFee: z.coerce
    .number()
    .min(DELIVERY_FEE_MIN, `La tarifa mínima es S/ ${DELIVERY_FEE_MIN}`)
    .max(DELIVERY_FEE_MAX, `La tarifa máxima es S/ ${DELIVERY_FEE_MAX}`),
})

export type DeliveryOfferInput = z.infer<typeof deliveryOfferSchema>
