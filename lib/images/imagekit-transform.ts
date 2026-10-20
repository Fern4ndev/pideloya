/**
 * Añade transforms de ImageKit a una URL SI pertenece al CDN de ImageKit
 * (los thumbnails piden la imagen a resolución completa — 2000 px para
 * pintar 40 px — y descargan formatos no óptimos). Con `?tr=w-<w>,f-auto,
 * q-80` ImageKit redimensiona en su edge, elige WebP/AVIF según el
 * navegador y limita la calidad: ~10-20 KB por miniatura en vez de cientos.
 *
 * Width-only a propósito: con w+h ImageKit recorta (crop) por defecto y
 * los avatares/logos ya recortan con CSS object-cover — no queremos perder
 * borde por un crop doble.
 *
 * Para URLs NO ImageKit (assets locales, fotos de prueba) devuelve la URL
 * intacta: el helper es un no-op seguro.
 */
const IMAGEKIT_HOST_MARKERS = ['ik.imagekit.io']

export function withImageKitTransform(
  url: string | null | undefined,
  width: number
): string {
  if (!url) return ''
  if (!IMAGEKIT_HOST_MARKERS.some((marker) => url.includes(marker))) return url

  const separator = url.includes('?') ? '&' : '?'
  return `${url}${separator}tr=w-${width},f-auto,q-80`
}
