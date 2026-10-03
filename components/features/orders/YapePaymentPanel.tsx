'use client'

import Image from 'next/image'
import { ExpandIcon } from 'lucide-react'
import { CopyButton } from '@/components/ui/copy-button'
import { PaymentVoucherPicker } from '@/components/features/orders/PaymentVoucherPicker'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { formatPePhone } from '@/lib/format/phone'
/**
 * Todo lo que el cliente necesita para pagar por Yape y adjuntar el
 * comprobante: el único camino de la tarjeta que necesita QR, archivo y
 * comprobante. Extraído de DeliveryPaymentCard en un ciclo anterior, sin
 * cambios funcionales.
 *
 * Va en su PROPIO archivo y se carga con `next/dynamic` (`ssr: false`) desde la
 * tarjeta: quien elige pagar al recibir nunca necesita el QR ni el compresor de
 * imágenes del navegador, así que no tiene por qué descargarlos. El resto de las
 * decisiones (el QR tocable para ampliarlo, el número agrupado que se copia sin
 * espacios, la degradación con gracia cuando falta QR o número, el comprobante
 * obligatorio con su explicación) se conservan TAL CUAL: ya estaban validadas en
 * el ciclo anterior.
 *
 * Es un componente de presentación: recibe `file` y avisa por `onFileChange`,
 * pero no sube nada ni conoce Supabase. El flujo de subida vive en el padre,
 * que es el único que sabe si hay una operación en curso (`busy`) y el único que
 * puede deshabilitar el selector de opciones mientras tanto.
 *
 * Recorte del plan: se quitaron los encabezados numerados (1/2/3) y el aviso de
 * bloqueo propio. El orden visual ya cuenta la secuencia —QR o número,
 * comprobante y botón— y el aviso de que la elección es definitiva vive UNA
 * sola vez en la tarjeta, debajo del control que confirma.
 */
export function YapePaymentPanel({
  fullName,
  yapeQrUrl,
  phone,
  amount,
  file,
  onFileChange,
  busy,
  busyLabel,
  onConfirm,
}: {
  fullName: string
  yapeQrUrl: string | null
  /** Celular crudo del repartidor (9 dígitos) o null si no lo registró. */
  phone: string | null
  /** Total a transferir, ya formateado con dos decimales (ej. "27.50"):
   *  comida + envío (D1). Un solo monto en todo el plan; la tarifa de envío
   *  suelta sigue visible en el encabezado de la tarjeta, donde es el dato del
   *  repartidor, pero lo que se transfiere es el total. */
  amount: string
  file: File | null
  onFileChange: (file: File | null) => void
  busy: boolean
  busyLabel?: string
  onConfirm: () => void
}) {
  const digits = phone?.replace(/\D/g, '') ?? ''

  return (
    <div className="space-y-3">
      <div className="border-t border-amber-300/60 pt-4 dark:border-amber-500/25">
        <h3 className="text-sm font-semibold text-amber-900 dark:text-amber-100">
          Paga S/ {amount} por Yape
        </h3>

        <div className="mt-3 space-y-3">
          {yapeQrUrl ? (
            <Dialog>
              <DialogTrigger
                render={
                  <button
                    type="button"
                    className="flex w-full flex-col items-center gap-1 rounded-2xl border border-black/5 bg-white p-3 transition-colors hover:border-amber-400/60 dark:border-white/10 dark:bg-white/5"
                  />
                }
              >
                <span className="relative block h-40 w-40 max-w-full">
                  <Image
                    src={yapeQrUrl}
                    alt="QR de Yape del repartidor"
                    fill
                    sizes="160px"
                    className="object-contain"
                  />
                </span>
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <ExpandIcon className="h-3.5 w-3.5" aria-hidden />
                  Toca para ampliarlo
                </span>
              </DialogTrigger>
              <DialogContent className="flex flex-col items-center gap-3 sm:max-w-xs">
                <span className="relative block h-72 w-72 max-w-full">
                  <Image
                    src={yapeQrUrl}
                    alt="QR de Yape del repartidor"
                    fill
                    sizes="288px"
                    className="object-contain"
                  />
                </span>
                <DialogTitle className="text-center text-sm font-normal text-muted-foreground">
                  Escanéalo y transfiere S/ {amount} por Yape: comida + envío.
                </DialogTitle>
              </DialogContent>
            </Dialog>
          ) : (
            // Degradación con gracia: un repartidor sin QR no rompe la tarjeta.
            // Se le dice al cliente qué hacer en cada caso — si hay número, ese
            // pasa a ser la vía de pago; si tampoco lo hay, la única salida
            // honesta es avisarle que no hay un medio de pago a la vista.
            <p className="rounded-2xl border border-dashed border-amber-400/60 px-4 py-3 text-xs text-amber-900 dark:text-amber-100">
              {digits
                ? `${fullName} todavía no cargó su QR de Yape. Pídele el pago al número de abajo.`
                : `${fullName} todavía no cargó su QR de Yape ni tiene un número registrado. Confirma el pago únicamente si ya acordaron cómo transferirle.`}
            </p>
          )}

          {/* La fila solo se renderiza si HAY número: un botón de copiar vacío
              es peor que no mostrarlo. La acción (copiar) va `shrink-0` y el
              bloque de texto `min-w-0`, para que un número largo no empuje el
              botón fuera de la tarjeta. */}
          {digits && (
            <div className="flex items-center justify-between gap-3 rounded-2xl border border-black/5 bg-white p-3 dark:border-white/10 dark:bg-white/5">
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">
                  {yapeQrUrl ? 'O yapea a este número' : 'Yapea a este número'}
                </p>
                {/* `select-all`: si el portapapeles fallara por completo, un
                    toque largo selecciona el número entero y el cliente puede
                    copiarlo a la vieja usanza. */}
                <p className="select-all text-lg font-semibold tabular-nums tracking-wide">
                  {formatPePhone(digits)}
                </p>
              </div>
              <CopyButton value={digits} label="número del repartidor" />
            </div>
          )}
        </div>
      </div>

      <PaymentVoucherPicker
        file={file}
        onChange={onFileChange}
        busy={busy}
        busyLabel={busyLabel}
      />

      <Button
        type="button"
        onClick={onConfirm}
        disabled={!file || busy}
        className="h-11 w-full rounded-full"
      >
        {busy ? (busyLabel ?? 'Confirmando…') : 'Ya pagué, confirmar'}
      </Button>

      {/* El estado deshabilitado del botón se explica SIEMPRE que esté
          deshabilitado por falta de archivo (no por estar en curso). Sin este
          texto, un botón gris es un callejón sin salida. */}
      {!file && (
        <p className="text-center text-xs text-amber-900 dark:text-amber-100">
          Adjunta tu comprobante para poder confirmar
        </p>
      )}
    </div>
  )
}
