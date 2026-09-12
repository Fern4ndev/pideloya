'use client'

import {
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type MouseEvent,
} from 'react'
import { upload } from '@imagekit/next'
import { getImageKitAuthParams } from '@/lib/actions/imagekit'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { ImagePlusIcon, Loader2Icon, PencilIcon, XIcon } from 'lucide-react'

export interface UploadedImage {
  url: string
  fileId: string
}

const SIZE_CLASSES = {
  sm: 'h-20 w-20',
  md: 'h-28 w-28',
  lg: 'h-40 w-40 sm:h-48 sm:w-48',
} as const

export function ImageUploader({
  label,
  currentUrl,
  folder,
  onUploaded,
  onRemove,
  helpText = 'JPG, PNG o WEBP · máx. 3MB',
  size = 'md',
  align = 'left',
}: {
  label: string
  currentUrl: string | null
  /** Carpeta dentro de ImageKit, solo para organización — ej. "/restaurants/abc123/logo" */
  folder: string
  onUploaded: (image: UploadedImage) => void
  /** Si se define, muestra un botón para quitar la foto sin subir una nueva */
  onRemove?: () => void
  helpText?: string
  size?: keyof typeof SIZE_CLASSES
  /** "center" apila el recuadro y el texto de ayuda debajo, centrados —
   * pensado para formularios donde la foto es el elemento principal
   * (ej. producto). "left" (default) los pone lado a lado. */
  align?: 'left' | 'center'
}) {
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(currentUrl)
  const [progress, setProgress] = useState(0)
  const [isUploading, setIsUploading] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function processFile(file: File) {
    if (!file.type.startsWith('image/')) {
      setError('El archivo debe ser una imagen')
      return
    }
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

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) processFile(file)
  }

  function handleDragOver(e: DragEvent<HTMLLabelElement>) {
    e.preventDefault()
    if (!isUploading) setIsDragging(true)
  }

  function handleDrop(e: DragEvent<HTMLLabelElement>) {
    e.preventDefault()
    setIsDragging(false)
    if (isUploading) return
    const file = e.dataTransfer.files?.[0]
    if (file) processFile(file)
  }

  function handleRemove(e: MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    setPreview(null)
    setError(null)
    onRemove?.()
  }

  return (
    <div
      className={cn(
        'space-y-2',
        align === 'center' && 'flex flex-col items-center text-center'
      )}
    >
      <Label htmlFor={inputId}>{label}</Label>

      <div
        className={cn(
          'flex items-center gap-4',
          align === 'center' && 'flex-col gap-2'
        )}
      >
        <label
          htmlFor={inputId}
          onDragOver={handleDragOver}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={cn(
            'group/uploader relative flex shrink-0 cursor-pointer flex-col items-center justify-center overflow-hidden rounded-2xl border-2 bg-muted/40 transition-colors',
            SIZE_CLASSES[size],
            preview ? 'border-solid border-transparent' : 'border-dashed',
            !preview &&
              (isDragging
                ? 'border-primary bg-primary/5'
                : 'border-muted-foreground/25 hover:border-muted-foreground/40 hover:bg-muted/60')
          )}
        >
          {preview ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={preview}
                alt={label}
                className="h-full w-full object-cover"
              />

              {/* Overlay "Cambiar" al pasar el mouse */}
              <div className="absolute inset-0 flex items-center justify-center gap-1.5 bg-black/0 opacity-0 transition-all duration-150 group-hover/uploader:bg-black/50 group-hover/uploader:opacity-100">
                <PencilIcon className="h-4 w-4 text-white" />
                <span className="text-xs font-medium text-white">
                  Cambiar
                </span>
              </div>

              {/* Botón "Quitar" */}
              {onRemove && !isUploading && (
                <button
                  type="button"
                  onClick={handleRemove}
                  className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity hover:bg-black/80 group-hover/uploader:opacity-100"
                  aria-label="Quitar foto"
                >
                  <XIcon className="h-3.5 w-3.5" />
                </button>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center gap-1.5 px-2 text-center">
              <ImagePlusIcon className="h-6 w-6 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground">
                Subir foto
              </span>
            </div>
          )}

          {/* Progreso de subida */}
          {isUploading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-black/55 text-white">
              <Loader2Icon className="h-5 w-5 animate-spin" />
              <span className="text-xs font-medium">{progress}%</span>
            </div>
          )}

          <input
            ref={inputRef}
            id={inputId}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleFileChange}
            disabled={isUploading}
            className="sr-only"
          />
        </label>

        <div
          className={cn(
            'flex flex-1 flex-col gap-1',
            align === 'center' && 'flex-none items-center'
          )}
        >
          <p className="text-xs text-muted-foreground">{helpText}</p>
          {align === 'left' && (
            <p className="text-xs text-muted-foreground">
              Arrastra una imagen aquí o haz clic en el recuadro.
            </p>
          )}
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}