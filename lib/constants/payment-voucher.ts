/**
 * Constantes del comprobante de pago (voucher de Yape) del envío.
 *
 * Viven acá y no dispersas en cada archivo por un motivo concreto: la ruta del
 * comprobante es un dato que cruzan CUATRO capas — el navegador que sube (Fase
 * 4), la Server Action que confirma, la API v1 y la función SQL que lo valida
 * contra el CHECK de `deliveries`. Si cada una arma el string a mano, la
 * primera que se desvíe produce un error opaco ("Adjunta el comprobante") en
 * una ruta que sí lo tiene. Un solo lugar, un solo formato.
 */

/** Bucket privado (ver supabase/migrations/20260930100000). */
export const PAYMENT_VOUCHER_BUCKET = 'payment-vouchers'

/**
 * Ruta ÚNICA y canónica del comprobante de un pedido.
 *
 * Un solo archivo por pedido, extensión fija `.jpg`: el cliente re-encodea la
 * imagen a JPEG en el navegador antes de subirla, así que la extensión nunca
 * miente. Eso acota los archivos huérfanos posibles a uno por pedido y hace
 * trivial la limpieza (Fase 6). El nombre debe coincidir exactamente con lo que
 * valida la función SQL `select_delivery_payment` (y su envoltorio
 * `confirm_delivery_payment`) y con el CHECK `deliveries_voucher_path_check`.
 */
export function paymentVoucherPath(orderId: string): string {
  return `${orderId}/voucher.jpg`
}

/** Lado mayor al que se re-encodea la imagen en el navegador. */
export const VOUCHER_MAX_SIDE_PX = 1600

/** Calidad del re-encodeo a JPEG (0-1). */
export const VOUCHER_JPEG_QUALITY = 0.82

/**
 * Tope de ENTRADA del archivo elegido (20 MB), generoso a propósito: la imagen
 * se comprime en el navegador antes de subirla, así que una foto de cámara de
 * 6 MB es normal y no debe rechazarse. El tope REAL (5 MB) lo hace cumplir el
 * bucket sobre el resultado ya comprimido, no acá.
 */
export const VOUCHER_INPUT_MAX_BYTES = 20 * 1024 * 1024

/**
 * Límite del bucket (5 MB). Debe coincidir con `file_size_limit` de
 * supabase/migrations/20260930100000_payment_vouchers_storage.sql: si se
 * cambia uno hay que cambiar el otro, porque la barrera que de verdad importa
 * es la del servidor de Storage (la del navegador se puede saltar).
 */
export const VOUCHER_MAX_BYTES = 5 * 1024 * 1024

/**
 * Vigencia de la URL firmada de lectura. 1 h es suficiente para ver el
 * comprobante durante la entrega y lo bastante corto para que una URL filtrada
 * (logs, historial, captura de pantalla del enlace) deje de servir rápido. No
 * se usa `next/image` con estas URLs: el optimizador las cachearía fuera del
 * control de expiración.
 */
export const VOUCHER_SIGNED_URL_TTL_S = 60 * 60
