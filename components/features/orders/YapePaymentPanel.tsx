'use client'

import type { ReactNode } from 'react'
import Image from 'next/image'
import { ExpandIcon } from 'lucide-react'
import { CopyButton } from '@/components/ui/copy-button'
import { PaymentVoucherPicker } from '@/components/features/orders/PaymentVoucherPicker'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { formatPePhone } from '@/lib/format/phone'
import { PAYMENT_METHOD_LOCK_NOTICE } from '@/lib/constants/payment-method'

/**
 * Encabezado numerado de cada paso. Vive fuera del componente a propósito:
 * definirlo adentro lo re-crearía en cada render (identidad nueva → React lo
 * desmonta y remonta, perdiendo el DOM real y el foco).
 */
function StepHeading({ step, children }: { step: number; children: ReactNode }) {
  return (
    <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-amber-900 dark:text-amber-100">
      <span
        aria-hidden
        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-[11px] font-bold text-amber-800 dark:text-amber-200"
      >
        {step}
      </span>
      {children}
    </h3>
  )
}

/**
 * Paso 2 de la tarjeta de pago: todo lo que el cliente necesita para pagar por
 * Yape y adjuntar el comprobante. Extraído de DeliveryPaymentCard en la Fase 4
 * del plan del método de pago, sin cambios funcionales.
 *
 * Va en su PROPIO archivo y se carga con `next/dynamic` (`ssr: false`) desde la
 * tarjeta: quien elige pagar en efectivo nunca necesita el QR ni el compresor de
 * imágenes del navegador, así que no tiene por qué descargarlos. El resto de las
 * decisiones (el QR tocable para ampliarlo, el número agrupado que se copia sin
 * espacios, la degradación con gracia cuando falta QR o número, el comprobante
 * obligatorio con su explicación) se conservan TAL CUAL: ya estaban validadas en
 * el ciclo anterior.
 *
 * Es un componente de presentación: recibe `file` y avisa por `onFileChange`,
 * pero no sube nada ni conoce Supabase. El flujo de subida vive en el padre,
 * que es el único que sabe si hay una operación en curso (`busy`) y el único que
 * puede deshabilitar el selector de método mientras tanto.
 */
export function YapePaymentPanel({
  fullName,
  yapeQrUrl,
  phone,
  fee,
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
  /** Tarifa de envío ya formateada con dos decimales (ej. "7.50"). */
  fee: string
  file: File | null
  onFileChange: (file: File | null) => void
  busy: boolean
  busyLabel?: string
  onConfirm: () => void
}) {
  const digits = phone?.replace(/\D/g, '') ?? ''

  return (
    <div className="space-y-3">
      {/* ------------------------------- Paso 1 ------------------------------ */}
      <div className="border-t border-amber-300/60 pt-4 dark:border-amber-500/25">
        <StepHeading step={1}>Paga por Yape</StepHeading>

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
                  Escanéalo y transfiere S/ {fee} por Yape.
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

      {/* ------------------------------- Paso 2 ------------------------------ */}
      <div className="border-t border-amber-300/60 pt-4 dark:border-amber-500/25">
        <StepHeading step={2}>Adjunta tu comprobante</StepHeading>
        <div className="mt-3">
          <PaymentVoucherPicker
            file={file}
            onChange={onFileChange}
            busy={busy}
            busyLabel={busyLabel}
          />
        </div>
      </div>

      {/* ------------------------------- Paso 3 ------------------------------ */}
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

      <p className="text-center text-xs text-amber-900 dark:text-amber-100">
        {PAYMENT_METHOD_LOCK_NOTICE}
      </p>
    </div>
  )
}
