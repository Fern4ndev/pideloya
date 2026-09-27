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
  onStaged,
  staged = false,
  onRemove,
  helpText = 'JPG, PNG o WEBP · máx. 3MB',
  size = 'md',
  align = 'left',
  shape = 'square',
  fit = 'cover',
  disabled = false,
}: {
  label: string
  currentUrl: string | null
  /** Carpeta dentro de ImageKit, solo para organización — ej. "/restaurants/abc123/logo" */
  folder: string
  /** Se ejecuta tras subir exitosamente a ImageKit (modo inmediato). */
  onUploaded?: (image: UploadedImage) => void
  /**
   * Modo diferido (`staged`): en vez de subir a ImageKit, el archivo se
   * queda en memoria y se notifica aquí. La subida real ocurre después,
   * cuando la UI lo decida (ej. al pulsar "Guardar cambios").
   */
  onStaged?: (file: File) => void
  /**
   * Activa el modo diferido: validar + preview local, sin tocar ImageKit.
   * Solo lo usan los uploaders del perfil de repartidor; logo/producto
   * siguen en modo inmediato (default).
   */
  staged?: boolean
  /** Si se define, muestra un botón para quitar la foto sin subir una nueva */
  onRemove?: () => void
  helpText?: string
  size?: keyof typeof SIZE_CLASSES
  /** "center" apila el recuadro y el texto de ayuda debajo, centrados —
   * pensado para formularios donde la foto es el elemento principal
   * (ej. producto). "left" (default) los pone lado a lado. */
  align?: 'left' | 'center'
  /** Forma del recuadro de vista previa. "circle" para la foto de una
   * persona (avatar del repartidor): un círculo comunica "esto eres tú"
   * y separa visualmente el avatar de los logos/QR. "square" (default)
   * para logo y QR, donde recortar las esquinas perjudica la lectura. */
  shape?: 'square' | 'circle'
  /** Cómo encaja la imagen en el recuadro. "cover" (default) la recorta
   * para llenarlo — correcto para un logo o una foto de perfil. "contain"
   * la muestra completa con fondo alrededor — imprescindible para un QR:
   * una foto rectangular recortada a cuadrado puede cortar el propio
   * código y dejarlo imposible de escanear. */
  fit?: 'cover' | 'contain'
  /** Bloquea la selección mientras la UI principal está en proceso
   * (ej. "Guardando…" con uploads diferidos pendientes). */
  disabled?: boolean
}) {
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(currentUrl)
  const [progress, setProgress] = useState(0)
  const [isUploading, setIsUploading] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // El preview local (objectURL) y `currentUrl` del servidor conviven: si
  // la URL del servidor cambia (la Server Action revalidó tras guardar),
  // el preview pasa a ser esa URL — que es la fuente de verdad. Sin esto,
  // un preview local quedaría mostrando el archivo viejo tras revalidar.
  // Patrón "ajustar estado durante el render" (react.dev) en vez de un
  // effect con setState, que este repo prohíbe en lint.
  const [prevCurrentUrl, setPrevCurrentUrl] = useState(currentUrl)
  if (currentUrl !== prevCurrentUrl) {
    setPrevCurrentUrl(currentUrl)
    setPreview(currentUrl)
  }

  async function processFile(file: File) {
    if (disabled) return
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

    // Modo diferido: la validación y el preview ya están; el archivo se
    // guarda en el draft y NADA viaja a ImageKit hasta que la UI lo
    // decida (p. ej. "Guardar cambios").
    if (staged) {
      onStaged?.(file)
      if (inputRef.current) inputRef.current.value = ''
      return
    }

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

      onUploaded?.({ url: result.url, fileId: result.fileId })
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
    if (!isUploading && !disabled) setIsDragging(true)
  }

  function handleDrop(e: DragEvent<HTMLLabelElement>) {
    e.preventDefault()
    setIsDragging(false)
    if (isUploading || disabled) return
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
            'group/uploader relative flex shrink-0 cursor-pointer flex-col items-center justify-center overflow-hidden border-2 bg-muted/40 transition-colors',
            SIZE_CLASSES[size],
            shape === 'circle' ? 'rounded-full' : 'rounded-2xl',
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
                className={cn(
                  'h-full w-full',
                  fit === 'contain' ? 'object-contain' : 'object-cover'
                )}
              />

              {/* Overlay "Cambiar" al pasar el mouse */}
              <div className="absolute inset-0 flex items-center justify-center gap-1.5 bg-black/0 opacity-0 transition-all duration-150 group-hover/uploader:bg-black/50 group-hover/uploader:opacity-100">
                <PencilIcon className="h-4 w-4 text-white" />
                <span className="text-xs font-medium text-white">
                  Cambiar
                </span>
              </div>

              {/* Botón "Quitar" */}
              {onRemove && !isUploading && !disabled && (
                <button
                  type="button"
                  onClick={handleRemove}
                  className={cn(
                    'absolute flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white transition-opacity hover:bg-black/80 focus-visible:opacity-100',
                    shape === 'circle'
                      ? // En un círculo, `right-1.5 top-1.5` cae fuera de la
                        // circunferencia: la esquina superior derecha es
                        // justo lo que el `rounded-full` elimina, y el
                        // `overflow-hidden` del recuadro recortaría el
                        // botón hasta dejarlo invisible. Anclado abajo al
                        // centro entra completo en cualquier tamaño.
                        // Además, en un dispositivo táctil no existe
                        // `:hover` (los repartidores usan el celular):
                        // mostrarlo siempre donde no hay puntero fino, o
                        // si recibe foco por teclado. El avatar es el
                        // único que necesita esto; logo/QR conservan el
                        // comportamiento de siempre (aparece al pasar el
                        // mouse) para no alterar su UI ya validada.
                        'bottom-1.5 left-1/2 -translate-x-1/2 opacity-100 pointer-fine:opacity-0 pointer-fine:group-hover/uploader:opacity-100'
                      : 'right-1.5 top-1.5 opacity-0 group-hover/uploader:opacity-100'
                  )}
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
            disabled={isUploading || disabled}
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

      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </div>
  )
}