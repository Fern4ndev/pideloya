'use client'

import { useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { ExpandIcon } from 'lucide-react'
import { confirmDeliveryPayment } from '@/lib/actions/orders'
import { DeliveryAvatar } from '@/components/features/admin/DeliveryAvatar'
import { CopyButton } from '@/components/ui/copy-button'
import { PaymentVoucherPicker } from '@/components/features/orders/PaymentVoucherPicker'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { useToast } from '@/components/ui/toast'
import { createClient } from '@/lib/db/client'
import { toVoucherJpeg } from '@/lib/images/compress-voucher'
import { formatPePhone } from '@/lib/format/phone'
import { PAYMENT_VOUCHER_BUCKET, paymentVoucherPath } from '@/lib/constants/payment-voucher'

export type DeliveryOffer = {
  fullName: string
  avatarUrl: string | null
  yapeQrUrl: string | null
  /** Celular con el que el repartidor cobra por Yape. Puede faltar si su
   * cuenta está incompleta: en ese caso la fila del número no se renderiza. */
  phone: string | null
  deliveryFee: number
}

/** Fases del envío del comprobante. Se modela explícitamente porque cada una
 *  tarda distinto y el usuario tiene que poder distinguirlas: comprimir una
 *  foto de 6 MB no es lo mismo que subirla con mala señal. */
type Phase = 'idle' | 'preparing' | 'uploading' | 'confirming'

const PHASE_LABEL: Record<Exclude<Phase, 'idle'>, string> = {
  preparing: 'Preparando imagen…',
  uploading: 'Subiendo comprobante…',
  confirming: 'Confirmando…',
}

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
 * Tarjeta de pago del envío: aparece SOLO cuando el pedido está en
 * AWAITING_PAYMENT, es decir cuando ya hay un repartidor con una tarifa
 * propuesta esperando que el cliente le pague por Yape.
 *
 * El cliente tiene UNA tarea con TRES pasos, y la tarjeta lo dice y los ordena:
 * 1) pagar, 2) adjuntar el comprobante, 3) confirmar. Antes había un párrafo
 * —"Escanea el QR y paga… no verificamos el pago automáticamente…"— que
 * competía con esa tarea: información importante enterrada en prosa, en el
 * lugar donde debería estar la acción. Se eliminó y su función informativa la
 * cumple el orden numerado, que se lee de un vistazo.
 *
 * Decisiones que no son cosméticas:
 *
 * 1. El QR es tocable para verlo en grande. Escanear un QR de 160 px desde el
 *    celular de al lado funciona a duras penas; en grande, siempre.
 * 2. El número del repartidor se muestra agrupado (987 654 321) pero se COPIA
 *    sin espacios (987654321), que es lo que Yape acepta al pegar.
 * 3. Los tokens son ámbar — el lenguaje de "esperando algo de alguien" que el
 *    proyecto ya usa en los banners de negocio cerrado y de pedido buscando
 *    repartidor — y no un color nuevo.
 * 4. La tarjeta entra con `animate-fade-up`: ahora que puede aparecer sola por
 *    realtime, el movimiento es lo que dice "acaba de llegar algo nuevo". La
 *    regla global de `prefers-reduced-motion` la neutraliza sin trabajo extra.
 * 6. Contraste medido, no estimado: los textos pequeños de la tarjeta usan
 *    `amber-900` (~8.8:1 sobre el fondo ámbar) en vez de `muted-foreground`,
 *    que sobre este fondo queda en ~4.7:1 — pasa, pero sin margen para que un
 *    cambio de token lo rompa en silencio.
 * 5. El comprobante es obligatorio para confirmar (el botón está deshabilitado
 *    y un texto visible explica por qué): es la única evidencia que le queda al
 *    repartidor de que le pagaron, porque no hay pasarela integrada. Un botón
 *    gris sin explicación es un callejón sin salida.
 */
export function DeliveryPaymentCard({
  orderId,
  deliveryPerson,
}: {
  orderId: string
  deliveryPerson: DeliveryOffer
}) {
  const router = useRouter()
  const { error, success } = useToast()
  const [file, setFile] = useState<File | null>(null)
  const [phase, setPhase] = useState<Phase>('idle')

  const fee = deliveryPerson.deliveryFee.toFixed(2)
  const digits = deliveryPerson.phone?.replace(/\D/g, '') ?? ''
  const busy = phase !== 'idle'

  /**
   * Sube el comprobante y recién después confirma el pago. El orden no es
   * negociable: la función SQL rechaza la confirmación si el archivo no existe
   * en Storage, justamente para que no se pueda dar por pagado un pedido sin
   * ninguna evidencia.
   *
   * El archivo se sube DIRECTO del navegador a Storage con la sesión del
   * cliente (RLS aplicada), no por Server Action: las Server Actions tienen un
   * límite de cuerpo de 1 MB por defecto y un comprobante no siempre cabe;
   * subir el límite global sería peor que este camino.
   *
   * Si algo falla, el archivo ELEGIDO se conserva: el cliente reintenta sin
   * volver a buscarlo en la galería. Y como el reintento usa la misma ruta con
   * `upsert`, nunca quedan dos comprobantes del mismo pedido.
   */
  async function handleConfirm() {
    if (!file || busy) return

    setPhase('preparing')
    try {
      const blob = await toVoucherJpeg(file)

      setPhase('uploading')
      const supabase = createClient()
      const { error: uploadError } = await supabase.storage
        .from(PAYMENT_VOUCHER_BUCKET)
        .upload(paymentVoucherPath(orderId), blob, {
          upsert: true,
          contentType: 'image/jpeg',
          // El comprobante es único por pedido y puede reemplazarse en un
          // reintento: cachear la versión vieja haría que el repartidor vea una
          // imagen que ya no es la que se envió.
          cacheControl: '0',
        })

      if (uploadError) {
        throw new Error(
          'No se pudo subir el comprobante. Revisa tu conexión e inténtalo de nuevo.'
        )
      }

      setPhase('confirming')
      await confirmDeliveryPayment(orderId)
      success('¡Listo! Tu repartidor ya puede ir por tu pedido.')
      // El pedido pasa a ASSIGNED: la Server Action revalida la ruta, y el
      // refresh explícito asegura que esta tarjeta desaparezca de la vista en
      // el mismo instante.
      router.refresh()
    } catch (err) {
      error('No se pudo confirmar', err instanceof Error ? err.message : undefined)
    } finally {
      setPhase('idle')
    }
  }

  return (
    <section
      aria-labelledby="delivery-payment-heading"
      className="animate-fade-up rounded-3xl border border-amber-300/60 bg-amber-50/60 p-5 dark:border-amber-500/30 dark:bg-amber-500/10"
    >
      <div className="flex items-center gap-3">
        <DeliveryAvatar
          url={deliveryPerson.avatarUrl}
          name={deliveryPerson.fullName}
          size="lg"
          className="h-14 w-14 ring-2 ring-white dark:ring-neutral-900"
        />
        <div className="min-w-0">
          <h2 id="delivery-payment-heading" className="text-sm font-medium">
            {deliveryPerson.fullName} llevará tu pedido
          </h2>
          {/* La tarifa sube de `text-xs` a `text-lg`: es EL dato que el cliente
              necesita para pagar, no una nota al pie. */}
          <p className="mt-1 flex flex-wrap items-baseline gap-x-1.5">
            <span className="text-xs text-amber-900 dark:text-amber-100">
              Costo de envío
            </span>
            <span className="text-lg font-semibold tabular-nums">S/ {fee}</span>
          </p>
        </div>
      </div>

      {/* ------------------------------- Paso 1 ------------------------------ */}
      <div className="mt-5 border-t border-amber-300/60 pt-4 dark:border-amber-500/25">
        <StepHeading step={1}>Paga por Yape</StepHeading>

        <div className="mt-3 space-y-3">
          {deliveryPerson.yapeQrUrl ? (
            <Dialog>
              <DialogTrigger
                render={
                  <button
                    type="button"
                    className="flex w-full flex-col items-center gap-1 rounded-2xl border border-black/5 bg-white p-3 transition-colors hover:border-amber-400/60 dark:border-white/10 dark:bg-white/5"
                  />
                }
              >
                <span className="relative block h-40 w-40">
                  <Image
                    src={deliveryPerson.yapeQrUrl}
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
                <span className="relative block h-72 w-72">
                  <Image
                    src={deliveryPerson.yapeQrUrl}
                    alt="QR de Yape del repartidor"
                    fill
                    sizes="288px"
                    className="object-contain"
                  />
                </span>
                {/* El texto se conserva tal cual (el pedido apuntaba al
                    párrafo de la tarjeta, no a este), pero como `DialogTitle`
                    para que el diálogo tenga nombre accesible. */}
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
                ? `${deliveryPerson.fullName} todavía no cargó su QR de Yape. Pídele el pago al número de abajo.`
                : `${deliveryPerson.fullName} todavía no cargó su QR de Yape ni tiene un número registrado. Confirma el pago únicamente si ya acordaron cómo transferirle.`}
            </p>
          )}

          {/* La fila solo se renderiza si HAY número: un botón de copiar vacío
              es peor que no mostrarlo. */}
          {digits && (
            <div className="flex items-center justify-between gap-3 rounded-2xl border border-black/5 bg-white p-3 dark:border-white/10 dark:bg-white/5">
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">
                  {deliveryPerson.yapeQrUrl ? 'O yapea a este número' : 'Yapea a este número'}
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
      <div className="mt-5 border-t border-amber-300/60 pt-4 dark:border-amber-500/25">
        <StepHeading step={2}>Adjunta tu comprobante</StepHeading>
        <div className="mt-3">
          <PaymentVoucherPicker
            file={file}
            onChange={setFile}
            busy={busy}
            busyLabel={phase === 'idle' ? undefined : PHASE_LABEL[phase]}
          />
        </div>
      </div>

      {/* ------------------------------- Paso 3 ------------------------------ */}
      <Button
        type="button"
        onClick={handleConfirm}
        disabled={!file || busy}
        className="mt-5 h-11 w-full rounded-full"
      >
        {phase === 'idle' ? 'Ya pagué, confirmar' : PHASE_LABEL[phase]}
      </Button>

      {/* El estado deshabilitado del botón se explica SIEMPRE que esté
          deshabilitado por falta de archivo (no por estar en curso). Sin este
          texto, un botón gris es un callejón sin salida. */}
      {!file && (
        <p className="mt-2 text-center text-xs text-amber-900 dark:text-amber-100">
          Adjunta tu comprobante para poder confirmar
        </p>
      )}
    </section>
  )
}
