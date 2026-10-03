'use client'

import { ImageUploader } from '@/components/features/restaurants/ImageUploader'
import { useProfileDraft } from './ProfileDraftProvider'

/**
 * Foto de perfil del usuario autenticado (hoy, solo la página de
 * repartidor la monta). Reutiliza el `ImageUploader` del proyecto entero
 * —drag&drop, validación de tipo/tamaño y preview— pero en MODO
 * DIFERIDO: elegir una foto solo deja un draft en memoria; ImageKit y la
 * base se tocan cuando "Guardar cambios" llama a `commitMedia()`
 * (ver `ProfileDraftProvider`).
 */
export function AvatarUploader({
  profileId,
  currentAvatarUrl,
}: {
  /** Solo para organizar la carpeta en ImageKit, no es una frontera de seguridad. */
  profileId: string
  currentAvatarUrl: string | null
}) {
  const { setDraft, isCommitting } = useProfileDraft()
  const folder = `/repartidores/${profileId}/avatar`

  return (
    <ImageUploader
      label="Foto de perfil"
      currentUrl={currentAvatarUrl}
      folder={folder}
      staged
      disabled={isCommitting}
      onStaged={(file) => setDraft('avatar', { type: 'file', file, folder })}
      onRemove={() =>
        // Con una foto guardada, quitarla marca draft de borrado (se
        // ejecuta al guardar). Sin foto guardada, solo descarta el
        // archivo pendiente.
        setDraft('avatar', currentAvatarUrl ? { type: 'remove' } : null)
      }
      shape="circle"
      size="lg"
      align="center"
      helpText="Se muestra en tu perfil. JPG, PNG o WEBP, máx. 3MB."
    />
  )
}
