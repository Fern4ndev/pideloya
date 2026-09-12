import ImageKit from '@imagekit/nodejs'
 
export const imageKitClient = new ImageKit({
  privateKey: process.env.IMAGEKIT_PRIVATE_KEY as string,
})
 
/**
 * Borra un archivo de ImageKit por su fileId. Nunca lanza error —
 * es una limpieza de "mejor esfuerzo": si falla, no debe romper el
 * flujo principal (que ya guardó la imagen NUEVA correctamente).
 * En el peor caso, queda un archivo viejo sin usar en ImageKit.
 */
export async function deleteImageKitFileSafe(fileId: string | null | undefined) {
  if (!fileId) return
 
  try {
    await imageKitClient.files.delete(fileId)
  } catch (err) {
    console.error('No se pudo borrar el archivo anterior de ImageKit:', err)
  }
}
 