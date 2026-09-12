'use server'

import { getUploadAuthParams } from '@imagekit/next/server'
import { createClient } from '@/lib/db/server'

/**
 * Genera un token de un solo uso, de corta duración, que autoriza al
 * navegador a subir UN archivo directo a nuestra cuenta de ImageKit —
 * sin que el archivo pase por nuestro servidor.
 *
 * Importante: este token NO restringe a qué carpeta se sube el archivo
 * (ImageKit no tiene un equivalente a RLS por carpeta como Supabase
 * Storage). La única barrera real es que solo un usuario AUTENTICADO
 * de PideloYa puede pedir este token — no cualquier visitante de
 * internet. El "folder" que usamos al subir es solo organización, no
 * una frontera de seguridad.
 */
export async function getImageKitAuthParams() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('No autenticado')

  const { token, expire, signature } = getUploadAuthParams({
    privateKey: process.env.IMAGEKIT_PRIVATE_KEY as string,
    publicKey: process.env.NEXT_PUBLIC_IMAGEKIT_PUBLIC_KEY as string,
  })

  return {
    token,
    expire,
    signature,
    publicKey: process.env.NEXT_PUBLIC_IMAGEKIT_PUBLIC_KEY as string,
  }
}