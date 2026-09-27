'use client'

import { useState, useTransition } from 'react'
import {
  ImageUploader,
  type UploadedImage,
} from '@/components/features/restaurants/ImageUploader'
import { removeYapeQr, saveYapeQr } from '@/lib/actions/profile'
import { useToast } from '@/components/ui/toast'

/**
 * QR de Yape del repartidor, para que el cliente le pague directo al
 * recibir el pedido. Opcional.
 *
 * La explicación de para qué sirve vive aquí y no en la tarjeta de la
 * página: es intrínseca al control, así que se mantiene aunque el
 * componente se monte en otro sitio.
 */
export function YapeQrUploader({
  profileId,
  currentYapeQrUrl,
}: {
  /** Solo para organizar la carpeta en ImageKit, no es una frontera de seguridad. */
  profileId: string
  currentYapeQrUrl: string | null
}) {
  const [, startTransition] = useTransition()
  const { error, success } = useToast()
  // Mismo motivo que en AvatarUploader: si el guardado falla, remontar el
  // uploader devuelve el preview al valor real del servidor.
  const [resetKey, setResetKey] = useState(0)

  function handleUploaded(image: UploadedImage) {
    startTransition(async () => {
      try {
        await saveYapeQr(image)
        success('QR de Yape actualizado')
      } catch (err) {
        error(
          'No se pudo guardar el QR',
          err instanceof Error ? err.message : undefined
        )
        setResetKey((key) => key + 1)
      }
    })
  }

  function handleRemove() {
    startTransition(async () => {
      try {
        await removeYapeQr()
        success('QR de Yape eliminado')
      } catch (err) {
        error(
          'No se pudo quitar el QR',
          err instanceof Error ? err.message : undefined
        )
        setResetKey((key) => key + 1)
      }
    })
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Tus clientes podrán escanear este código para pagarte directamente por
        Yape al recibir su pedido. Es opcional.
      </p>

      <ImageUploader
        key={resetKey}
        label="QR de Yape"
        currentUrl={currentYapeQrUrl}
        folder={`/repartidores/${profileId}/yape-qr`}
        // `contain`, no `cover`: recortar una foto rectangular a cuadrado
        // puede cortar el propio QR y dejarlo imposible de escanear.
        fit="contain"
        size="lg"
        align="center"
        onUploaded={handleUploaded}
        onRemove={handleRemove}
        helpText="Sube una foto nítida de tu QR · JPG, PNG o WEBP, máx. 3MB."
      />
    </div>
  )
}
