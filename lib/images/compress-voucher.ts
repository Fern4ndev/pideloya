import { VOUCHER_JPEG_QUALITY, VOUCHER_MAX_SIDE_PX } from '@/lib/constants/payment-voucher'

/**
 * Re-encodea en el navegador la foto del comprobante a JPEG, con el lado mayor
 * limitado. Se ejecuta SOLO en el cliente (necesita canvas y `createImageBitmap`).
 *
 * Por qué no subir el archivo tal cual (no es un lujo, es la diferencia entre
 * una subida usable y una insufrible):
 *
 * 1. **Peso.** Una foto de cámara pesa 3–8 MB. En la conexión de la mayoría de
 *    nuestros clientes eso es la diferencia entre 2 s y 20 s con el botón
 *    bloqueado en "Subiendo comprobante…". A 1600 px de lado mayor, un
 *    screenshot de Yape sigue perfectamente legible (monto y número de
 *    operación se leen de sobra) y pesa ~150-300 KB.
 * 2. **Formato único.** El bucket y la ruta asumen `.jpg`
 *    (`paymentVoucherPath`), así que normalizamos a JPEG acá en vez de
 *    perseguir extensiones. Un PNG transparente se aplana sobre blanco: sin el
 *    relleno, la transparencia se renderiza NEGRA al pasar a JPEG y el
 *    comprobante sale ilegible donde había transparencia.
 * 3. **Orientación.** Una foto vertical de celular guarda su rotación en el
 *    EXIF, no en los píxeles. Sin `imageOrientation: 'from-image'` el
 *    comprobante llega girado 90° y el repartidor no puede leerlo.
 *    (En navegadores que no soportan esa opción queda la orientación original:
 *    es un dato más, no un camino roto.)
 *
 * `bitmap.close()` es obligatorio: `createImageBitmap` reserva memoria fuera
 * del heap de JS y no la libera el recolector.
 */
/**
 * Mensaje único para "este archivo no se puede decodificar". Es un caso real
 * (foto truncada al descargar, archivo dañado, o un formato que el navegador no
 * soporta como HEIC en algunos Android) y el error nativo del navegador viene
 * en INGLÉS y habla de "source image": dentro de un toast en español no le dice
 * nada al cliente.
 */
const UNPROCESSABLE_MESSAGE = 'No pudimos procesar esa imagen. Prueba con otra foto o captura.'

export async function toVoucherJpeg(
  file: File,
  maxSide = VOUCHER_MAX_SIDE_PX,
  quality = VOUCHER_JPEG_QUALITY
): Promise<Blob> {
  // La decodificación es el paso que más falla y el único cuyo error nativo no
  // sirve para mostrar, así que se traduce acá (el llamador muestra
  // `err.message` tal cual).
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' }).catch(
    () => {
      throw new Error(UNPROCESSABLE_MESSAGE)
    }
  )

  try {
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)

    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error(UNPROCESSABLE_MESSAGE)

    // Fondo blanco explícito: JPEG no tiene canal alfa, y sin este relleno un
    // PNG transparente se convierte en un bloque negro.
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error(UNPROCESSABLE_MESSAGE))),
        'image/jpeg',
        quality
      )
    })
  } finally {
    bitmap.close()
  }
}
