'use client'

import { ImageUploader } from '@/components/features/restaurants/ImageUploader'
import { useProfileDraft } from './ProfileDraftProvider'

/**
 * QR de Yape del repartidor, para que el cliente le pague directo al
 * recibir el pedido. Opcional.
 *
 * La explicación de para qué sirve vive aquí y no en la tarjeta de la
 * página: es intrínseca al control, así que se mantiene aunque el
 * componente se monte en otro sitio.
 *
 * Mismo modo diferido que `AvatarUploader`: elegir/quitar el QR solo
 * deja un draft; la subida a ImageKit y el guardado ocurren con
 * "Guardar cambios" (`commitMedia()` en `ProfileDraftProvider`).
 */
export function YapeQrUploader({
  profileId,
  currentYapeQrUrl,
}: {
  /** Solo para organizar la carpeta en ImageKit, no es una frontera de seguridad. */
  profileId: string
  currentYapeQrUrl: string | null
}) {
  const { setDraft, isCommitting } = useProfileDraft()
  const folder = `/repartidores/${profileId}/yape-qr`

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Tus clientes podrán escanear este código para pagarte directamente por
        Yape al recibir su pedido. Es opcional.
      </p>

      <ImageUploader
        label="QR de Yape"
        currentUrl={currentYapeQrUrl}
        folder={folder}
        staged
        disabled={isCommitting}
        onStaged={(file) => setDraft('yape', { type: 'file', file, folder })}
        onRemove={() => setDraft('yape', currentYapeQrUrl ? { type: 'remove' } : null)}
        // `contain`, no `cover`: recortar una foto rectangular a cuadrado
        // puede cortar el propio QR y dejarlo imposible de escanear.
        fit="contain"
        size="lg"
        align="center"
        helpText="Sube una foto nítida de tu QR · JPG, PNG o WEBP, máx. 3MB."
      />
    </div>
  )
}
