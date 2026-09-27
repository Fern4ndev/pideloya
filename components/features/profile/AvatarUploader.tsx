'use client'

import { useState, useTransition } from 'react'
import {
  ImageUploader,
  type UploadedImage,
} from '@/components/features/restaurants/ImageUploader'
import { removeAvatar, saveAvatar } from '@/lib/actions/profile'
import { useToast } from '@/components/ui/toast'

/**
 * Foto de perfil del usuario autenticado (hoy, solo la página de
 * repartidor la monta). Reutiliza el `ImageUploader` del proyecto entero
 * —drag&drop, progreso, validación de tipo/tamaño y preview optimista—
 * en vez de duplicar esa lógica: aquí solo se conecta con la Server Action.
 */
export function AvatarUploader({
  profileId,
  currentAvatarUrl,
}: {
  /** Solo para organizar la carpeta en ImageKit, no es una frontera de seguridad. */
  profileId: string
  currentAvatarUrl: string | null
}) {
  const [, startTransition] = useTransition()
  const { error, success } = useToast()
  // Si ImageKit acepta el archivo pero el guardado en la base falla, el
  // preview local mostraría una foto que no está guardada. Cambiar la `key`
  // remonta el uploader con la URL real del servidor: la UI nunca miente
  // sobre lo que hay en la base.
  const [resetKey, setResetKey] = useState(0)

  function handleUploaded(image: UploadedImage) {
    startTransition(async () => {
      try {
        await saveAvatar(image)
        success('Foto de perfil actualizada')
      } catch (err) {
        error(
          'No se pudo guardar la foto',
          err instanceof Error ? err.message : undefined
        )
        setResetKey((key) => key + 1)
      }
    })
  }

  function handleRemove() {
    startTransition(async () => {
      try {
        await removeAvatar()
        success('Foto de perfil eliminada')
      } catch (err) {
        error(
          'No se pudo quitar la foto',
          err instanceof Error ? err.message : undefined
        )
        setResetKey((key) => key + 1)
      }
    })
  }

  return (
    <ImageUploader
      key={resetKey}
      label="Foto de perfil"
      currentUrl={currentAvatarUrl}
      folder={`/repartidores/${profileId}/avatar`}
      shape="circle"
      size="lg"
      align="center"
      onUploaded={handleUploaded}
      onRemove={handleRemove}
      helpText="Se muestra en tu perfil. JPG, PNG o WEBP, máx. 3MB."
    />
  )
}
