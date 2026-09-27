import { z } from 'zod'

/** Rango que acepta el SERVIDOR. Más amplio que cualquier valor sugerido por
 * UI, a propósito: no ata la validación a un número "mágico" que después
 * queramos ajustar sin tocar el backend. */
export const DELIVERY_FEE_MIN = 1
export const DELIVERY_FEE_MAX = 30

/** Tarifa inicial cuando no se conoce la distancia entre negocio y cliente. */
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

/**
 * Sugerencia de tarifa a partir de la distancia entre el negocio y la
 * dirección de entrega: S/ 1.50 por kilómetro (redondeando para arriba), con
 * un piso de S/ 5 — un envío de dos cuadras no vale menos que eso, y un viaje
 * corto no debería pagar menos que la tarifa por defecto de siempre.
 *
 * Nunca supera el máximo que acepta el servidor: sin el `min` final, un envío
 * de 21 km prellenaría el input con 31.5 y el navegador bloquearía el envío
 * por su propio `max`, que es la peor forma de comunicar un error.
 *
 * Es una SUGERENCIA, no una regla: el número llega como valor inicial de un
 * input editable, y el repartidor decide. La distancia es en línea recta, así
 * que en la práctica suele quedarse corta frente a la ruta real — se prefirió
 * eso a inflar la sugerencia con un factor de corrección inventado.
 */
export function suggestedDeliveryFee(distanceKm: number): number {
  const perKm = Math.ceil(distanceKm) * 1.5
  return Math.min(DELIVERY_FEE_MAX, Math.max(DEFAULT_DELIVERY_FEE, perKm))
}
