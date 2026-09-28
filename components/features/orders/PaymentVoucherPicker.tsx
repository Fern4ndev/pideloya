'use client'

import {
  useEffect,
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from 'react'
import { ImagePlusIcon, Loader2Icon, Trash2Icon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { VOUCHER_INPUT_MAX_BYTES } from '@/lib/constants/payment-voucher'

const INPUT_MAX_MB = Math.round(VOUCHER_INPUT_MAX_BYTES / (1024 * 1024))

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/**
 * Selector del comprobante de pago (voucher de Yape). **Componente
 * controlado**: recibe `file` y avisa por `onChange`; no sube nada ni conoce
 * Supabase. Así el padre decide CUÁNDO se sube —y el diseño elegido es que se
 * suba recién cuando el cliente pulsa "Ya pagué, confirmar", en un solo paso—
 * y este componente queda testeable sin red.
 *
 * Estados, todos diseñados (no improvisados):
 *
 * | Estado      | Qué ve el cliente                                              |
 * |-------------|----------------------------------------------------------------|
 * | Vacío       | Recuadro punteado con ícono + "Toca para subir tu comprobante"  |
 * | Con archivo | Miniatura, nombre, peso + botones Cambiar / Quitar              |
 * | Ocupado     | Overlay con spinner y la fase real ("Subiendo comprobante…")     |
 * | Error       | Mensaje `role="alert"` PEGADO al control, no un toast           |
 *
 * Sobre el error: un toast desaparece a los 4 s y puede quedar fuera de la
 * vista en un móvil; el error de un archivo tiene que seguir ahí mientras el
 * cliente decide qué hacer (elegir otra foto, comprimirla, etc.).
 *
 * Sobre el tope de peso: `VOUCHER_INPUT_MAX_BYTES` (20 MB) es un tope de
 * ENTRADA generoso, porque la imagen se re-encodea a JPEG en el navegador antes
 * de subirse. El tope real (5 MB) lo hace cumplir el bucket sobre el resultado
 * ya comprimido — es la única barrera que no se puede saltar desde el cliente.
 */
export function PaymentVoucherPicker({
  file,
  onChange,
  busy = false,
  busyLabel,
}: {
  file: File | null
  onChange: (file: File | null) => void
  /** Bloquea el control mientras el padre está subiendo/confirmando. */
  busy?: boolean
  /** Texto de la fase en curso, para el overlay. */
  busyLabel?: string
}) {
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  // La vista previa se apoya en un objectURL, que ocupa memoria hasta que se
  // revoca explícitamente. El ref guarda el actual para revocar el anterior en
  // cada cambio (elegir otra foto no acumula URLs) y para revocar el último al
  // desmontar. El efecto NO hace `setState` —solo libera—, así que no cae en la
  // regla del repo que prohíbe sincronizar estado dentro de un efecto.
  const [preview, setPreview] = useState<string | null>(null)
  const previewRef = useRef<string | null>(null)

  useEffect(
    () => () => {
      if (previewRef.current) URL.revokeObjectURL(previewRef.current)
    },
    []
  )

  function setPreviewUrl(url: string | null) {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current)
    previewRef.current = url
    setPreview(url)
  }

  function acceptFile(candidate: File) {
    if (!candidate.type.startsWith('image/')) {
      setError('Debe ser una imagen (JPG, PNG o WEBP)')
      return
    }
    if (candidate.size > VOUCHER_INPUT_MAX_BYTES) {
      setError(`La imagen no puede pesar más de ${INPUT_MAX_MB} MB`)
      return
    }
    setError(null)
    setPreviewUrl(URL.createObjectURL(candidate))
    onChange(candidate)
  }

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const candidate = e.target.files?.[0]
    // El input se limpia SIEMPRE para que elegir el mismo archivo dos veces
    // vuelva a disparar `change` (si no, el segundo intento no hace nada y
    // parece que la app se colgó).
    e.target.value = ''
    if (candidate) acceptFile(candidate)
  }

  function handleDragOver(e: DragEvent<HTMLLabelElement>) {
    e.preventDefault()
    if (!busy) setIsDragging(true)
  }

  function handleDrop(e: DragEvent<HTMLLabelElement>) {
    e.preventDefault()
    setIsDragging(false)
    if (busy) return
    const candidate = e.dataTransfer.files?.[0]
    if (candidate) acceptFile(candidate)
  }

  function handleRemove() {
    setError(null)
    setPreviewUrl(null)
    onChange(null)
  }

  return (
    <div className="space-y-2">
      <div className="relative">
        {file ? (
          // El archivo y sus acciones se APILAN en móvil, no van en la misma
          // fila: a 360 px, con la miniatura (64 px) y los dos botones (~175 px)
          // al lado, al nombre y al peso les quedaban ~100 px y el texto se
          // partía en cuatro líneas. Apilado, el nombre usa el ancho completo y
          // las acciones quedan debajo, a un pulgar de distancia.
          <div className="flex flex-col gap-3 rounded-2xl border border-black/5 bg-white p-3 sm:flex-row sm:items-center dark:border-white/10 dark:bg-white/5">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-muted">
                {preview && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={preview}
                    alt="Vista previa de tu comprobante"
                    className="h-full w-full object-cover"
                  />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{file.name}</p>
                <p className="text-xs text-muted-foreground">
                  {formatBytes(file.size)} · se comprime antes de subirla
                </p>
              </div>
            </div>
            {/* En móvil no existe `:hover`, así que las acciones están siempre
                visibles (no aparecen al pasar el mouse). */}
            <div className="flex shrink-0 gap-1.5">
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => inputRef.current?.click()}
                className="h-10 rounded-xl"
              >
                Cambiar
              </Button>
              <Button
                type="button"
                variant="ghost"
                disabled={busy}
                onClick={handleRemove}
                className="h-10 gap-1.5 rounded-xl text-destructive hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2Icon aria-hidden />
                Quitar
              </Button>
            </div>
          </div>
        ) : (
          <label
            htmlFor={inputId}
            onDragOver={handleDragOver}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            className={cn(
              'flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed px-4 py-6 text-center transition-colors',
              isDragging
                ? 'border-amber-500 bg-amber-100/60 dark:bg-amber-500/15'
                : 'border-amber-400/60 hover:border-amber-500 hover:bg-amber-100/40 dark:hover:bg-amber-500/10',
              busy && 'pointer-events-none opacity-60'
            )}
          >
            <ImagePlusIcon className="h-5 w-5 text-amber-700 dark:text-amber-400" aria-hidden />
            <span className="text-sm font-medium">Toca para subir tu comprobante</span>
            <span className="text-xs text-muted-foreground">
              Foto o captura de tu Yape · JPG, PNG o WEBP
            </span>
          </label>
        )}

        {busy && (
          // 90 % de opacidad y no 75 %: el estado de debajo (el recuadro punteado
          // o la miniatura) se transparentaba lo suficiente como para que los dos
          // textos se leyeran superpuestos. Sigue viéndose que hay algo detrás
          // —el contexto se conserva— pero ya no compite con la fase en curso.
          <div className="absolute inset-0 flex items-center justify-center gap-2 rounded-2xl bg-white/90 text-sm font-medium dark:bg-black/75">
            <Loader2Icon className="h-4 w-4 animate-spin" aria-hidden />
            {busyLabel}
          </div>
        )}
      </div>

      {/* El input vive fuera del label a propósito: el mismo control sirve para
          el recuadro vacío (vía `htmlFor`) y para el botón "Cambiar" (vía
          `click()`), así que no se puede duplicar. `sr-only` y no `hidden`: un
          input con `display:none` desaparece del árbol de accesibilidad y la
          tecnología asistiva pierde la única forma de elegir el archivo. */}
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept="image/*"
        onChange={handleChange}
        disabled={busy}
        className="sr-only"
      />

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
