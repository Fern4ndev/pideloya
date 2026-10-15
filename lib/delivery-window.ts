/**
 * Ventana para conseguir repartidor: 5 minutos desde que el cliente hace el
 * pedido. Si nadie oferta en ese tiempo, el pedido se cancela solo (el cliente
 * lo cancela desde su lista al vencer).
 *
 * Vive acá —y no copiada en cada pantalla— porque el MISMO vencimiento se
 * muestra en dos lugares: la lista del cliente y los Disponibles del
 * repartidor. Dos constantes iguales en dos archivos son dos valores que
 * pueden desincronizarse.
 */

/** 5 minutos en milisegundos. */
export const DELIVERY_SEARCH_TIMEOUT_MS = 5 * 60 * 1000

/**
 * Milisegundos restantes de la ventana a partir de `created_at`. Nunca
 * negativo: vencido es 0, no un número raro.
 */
export function remainingDeliveryWindowMs(
  createdAt: string | number | Date,
  now: number
): number {
  return Math.max(0, new Date(createdAt).getTime() + DELIVERY_SEARCH_TIMEOUT_MS - now)
}

/** `mm:ss` para el pill del contador (ej. "04:32"). */
export function formatRemainingDeliveryWindow(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}
