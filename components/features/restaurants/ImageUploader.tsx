'use client'

import { useState, useRef, type ChangeEvent } from 'react'
import { upload } from '@imagekit/next'
import { getImageKitAuthParams } from '@/lib/actions/imagekit'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export interface UploadedImage {
  url: string
  fileId: string
}

export function ImageUploader({
  label,
  currentUrl,
  folder,
  onUploaded,
  helpText = 'JPG, PNG o WEBP. Máximo 3MB.',
}: {
  label: string
  currentUrl: string | null
  /** Carpeta dentro de ImageKit, solo para organización — ej. "/restaurants/abc123/logo" */
  folder: string
  onUploaded: (image: UploadedImage) => void
  helpText?: string
}) {
  const [preview, setPreview] = useState<string | null>(currentUrl)
  const [progress, setProgress] = useState(0)
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 3 * 1024 * 1024) {
      setError('La imagen no puede pesar más de 3MB')
      return
    }

    setError(null)
    // Vista previa inmediata con el archivo local, mientras sube de
    // verdad — así no se siente lento aunque la red esté lenta.
    setPreview(URL.createObjectURL(file))
    setIsUploading(true)
    setProgress(0)

    try {
      const authParams = await getImageKitAuthParams()

      const result = await upload({
        ...authParams,
        file,
        fileName: file.name,
        folder,
        onProgress: (event) => {
          setProgress(Math.round((event.loaded / event.total) * 100))
        },
      })

      if (!result.url || !result.fileId) {
        throw new Error('ImageKit no devolvió la URL esperada')
      }

      onUploaded({ url: result.url, fileId: result.fileId })
      setPreview(result.url)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'No se pudo subir la imagen'
      )
      setPreview(currentUrl)
    } finally {
      setIsUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex items-center gap-4">
        <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl border bg-muted">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={preview}
              alt={label}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
              Sin imagen
            </div>
          )}
        </div>
        <div>
          <Input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleFileChange}
            disabled={isUploading}
          />
          {helpText && (
            <p className="mt-1 text-xs text-muted-foreground">{helpText}</p>
          )}
        </div>
      </div>
      {isUploading && (
        <p className="text-sm text-muted-foreground">Subiendo… {progress}%</p>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}