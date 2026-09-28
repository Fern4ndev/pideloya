'use client'

import { ZoomInIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

/**
 * Miniatura de un comprobante de pago (voucher de Yape) que se abre en grande
 * al tocarla. Es el único trozo de la fila de comprobante que necesita ser
 * cliente: el texto de al lado lo renderiza el servidor.
 *
 * Dos formas de abrir en el mismo diálogo (la miniatura y, si se pide, un botón
 * de texto) porque el mismo componente sirve para dos contextos con
 * necesidades distintas: la fila compacta del cliente, donde "Ver" es una
 * palabra suficiente, y la tarjeta del repartidor, donde el comprobante es su
 * evidencia de cobro y merece un botón explícito. Sin `actionLabel` solo queda
 * la miniatura.
 *
 * `eslint-disable` de `next/image`: estas URLs son FIRMADAS y expiran en 1 h.
 * Pasarlas por el optimizador de Next las cachearía fuera de ese control —la
 * imagen seguiría sirviéndose desde la caché después de que la URL dejó de ser
 * válida—, que es exactamente lo que la firma temporal busca evitar.
 */
export function PaymentVoucherViewer({
  url,
  alt,
  thumbnailClassName,
  actionLabel,
}: {
  /** URL firmada de lectura (Fase 3). */
  url: string
  /** Texto alternativo descriptivo: el comprobante es información, no adorno. */
  alt: string
  thumbnailClassName?: string
  /** Si se pasa, agrega un botón de texto que abre el mismo diálogo. */
  actionLabel?: string
}) {
  return (
    <Dialog>
      <DialogTrigger
        render={
          <button
            type="button"
            aria-label={`Ver ${alt} en grande`}
            className={cn(
              'group relative block h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-muted',
              thumbnailClassName
            )}
          />
        }
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt="" className="h-full w-full object-cover" />
        {/* El zoom se anuncia al pasar el mouse, pero no es obligatorio para
            usarlo: el botón entero es el objetivo táctil y su `aria-label` dice
            qué hace. Así el affordance no depende de `:hover` (que en táctil no
            existe). */}
        <span
          aria-hidden
          className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-opacity duration-150 group-hover:bg-black/40 group-hover:opacity-100"
        >
          <ZoomInIcon className="h-4 w-4 text-white" />
        </span>
      </DialogTrigger>

      {actionLabel && (
        <DialogTrigger
          render={<Button type="button" variant="outline" className="h-10 shrink-0 rounded-xl" />}
        >
          {actionLabel}
        </DialogTrigger>
      )}

      <DialogContent className="flex flex-col items-center gap-3 sm:max-w-lg">
        <span className="block max-h-[70vh] w-full overflow-hidden rounded-xl bg-muted">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt={alt} className="mx-auto max-h-[70vh] w-auto object-contain" />
        </span>
        {/* `DialogTitle` y no un `<p>`: es lo que le da NOMBRE al diálogo
            (base-ui cablea el aria-labelledby). Sin título, un lector de
            pantalla anuncia solo "diálogo" y el usuario no sabe qué se abrió.
            Las clases son las mismas del párrafo de siempre, así que el texto
            se ve igual. */}
        <DialogTitle className="text-center text-sm font-normal text-muted-foreground">
          {alt}
        </DialogTitle>
      </DialogContent>
    </Dialog>
  )
}
