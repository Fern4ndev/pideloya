'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { confirmDeliveryPayment } from '@/lib/actions/orders'
import { DeliveryAvatar } from '@/components/features/admin/DeliveryAvatar'
import { PaymentMethodChoice } from '@/components/features/orders/PaymentMethodChoice'
import { useToast } from '@/components/ui/toast'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/db/client'
import { PAYMENT_VOUCHER_BUCKET, paymentVoucherPath } from '@/lib/constants/payment-voucher'
import {
  PAYMENT_METHOD_LOCK_NOTICE,
  PAYMENT_METHOD_PROMPT,
  amountDueToCourier,
  type PaymentTiming,
} from '@/lib/constants/payment-method'

export type DeliveryOffer = {
  fullName: string
  avatarUrl: string | null
  yapeQrUrl: string | null
  /** Celular con el que el repartidor cobra por Yape. Puede faltar si su
   * cuenta está incompleta: en ese caso la fila del número no se renderiza. */
  phone: string | null
  deliveryFee: number
  /** Snapshot D7 de la oferta: ¿este repartidor acepta cobrar al recibir?
   * False => "Pagar al recibir" se muestra deshabilitada con motivo. */
  allowsPayOnDelivery: boolean
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
 * Esqueleto del panel de Yape: reserva una altura parecida a la del panel real
 * (bloques de QR, comprobante y botón) para que elegir "Pagar ahora" no empuje
 * el resto de la página. Sin esto, el panel entra cuando termina de descargarse
 * y todo lo de abajo salta — el layout shift clásico de una carga diferida.
 */
function YapePanelSkeleton() {
  return (
    <div className="space-y-3" aria-hidden>
      <div className="h-4 w-32 animate-pulse rounded bg-amber-500/15" />
      <div className="h-48 animate-pulse rounded-2xl bg-amber-500/10" />
      <div className="h-32 animate-pulse rounded-2xl bg-amber-500/10" />
      <div className="h-11 animate-pulse rounded-full bg-amber-500/15" />
    </div>
  )
}

/**
 * Carga diferida del panel de Yape "por adelantado": quien va a pagar al
 * recibir nunca necesita el QR ampliable del pago previo, el selector de
 * archivos ni el compresor de imágenes. `ssr: false` es correcto acá y no un
 * atajo: el panel solo existe después de una interacción del cliente (elegir
 * cómo paga), así que en el HTML del servidor no hay nada que hidratar.
 * El `loading` reserva la altura (sin CLS).
 */
const YapePaymentPanel = dynamic(
  () => import('./YapePaymentPanel').then((m) => m.YapePaymentPanel),
  { ssr: false, loading: () => <YapePanelSkeleton /> }
)

/**
 * Tarjeta de pago: aparece SOLO cuando el pedido está en AWAITING_PAYMENT, con
 * un repartidor y una tarifa propuesta esperando que el cliente decida cuándo
 * paga.
 *
 * La decisión es de UN nivel — `Pagar ahora` (Yape + comprobante) o `Pagar al
 * recibir` — porque el método con el que se cobra en la puerta dejó de
 * preguntarse (migración 20261003100000). Con "al recibir" la tarjeta confirma
 * en un toque; con "ahora" despliega el panel de Yape, que es el único camino
 * que sí necesita QR, archivo y comprobante.
 *
 * Decisiones heredadas que siguen sosteniendo el diseño:
 *
 * 1. SIN preselección (D3): es dinero. El CTA solo existe cuando hay una opción
 *    elegida; mientras no la haya, se muestra la ayuda.
 * 2. La elección es DEFINITIVA (D3 del ciclo anterior) y se avisa antes del
 *    clic, UNA sola vez, debajo del control que confirma.
 * 3. Mientras hay una operación en curso (`phase !== 'idle'`), `busy` se
 *    DERIVA de `phase` (dos estados para la misma verdad pueden contradecirse)
 *    y el selector queda deshabilitado.
 * 4. El archivo del comprobante vive ACÁ y no dentro del panel: alternar a
 *    "al recibir" y volver a "Pagar ahora" no borra la captura ya elegida.
 */
export function DeliveryPaymentCard({
  orderId,
  total,
  deliveryPerson,
}: {
  orderId: string
  /** Total del pedido (comida). En todas las opciones (D1) el cliente le paga
   *  al repartidor este monto MÁS el envío. */
  total: number
  deliveryPerson: DeliveryOffer
}) {
  const router = useRouter()
  const { error, success } = useToast()
  const [timing, setTiming] = useState<PaymentTiming | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [phase, setPhase] = useState<Phase>('idle')

  const fee = deliveryPerson.deliveryFee.toFixed(2)
  const due = amountDueToCourier(total, deliveryPerson.deliveryFee).toFixed(2)
  const busy = phase !== 'idle'

  /**
   * Pagar al recibir: no hay archivo que subir ni nada que verificar. Un toque
   * deja el pedido en ASSIGNED y el repartidor ya puede ir por él; lo que el
   * cliente pagará se le cobra al entregar, con el QR del repartidor en la
   * puerta. La Server Action valida el momento y la función SQL lo vuelve a
   * validar.
   */
  async function handleConfirmOnDelivery() {
    if (busy || timing !== 'ON_DELIVERY') return
    setPhase('confirming')
    try {
      await confirmDeliveryPayment(orderId, 'ON_DELIVERY')
      success('Listo. Tu repartidor va por tu pedido.')
      router.refresh()
    } catch (err) {
      error('No se pudo confirmar', err instanceof Error ? err.message : undefined)
    } finally {
      setPhase('idle')
    }
  }

  /**
   * Pagar ahora: sube el comprobante y recién después confirma. El orden no es
   * negociable: la función SQL rechaza la confirmación si el archivo no existe
   * en Storage.
   *
   * El archivo sube DIRECTO del navegador a Storage con la sesión del cliente
   * (RLS aplicada): las Server Actions tienen un límite de cuerpo de 1 MB y un
   * comprobante no siempre cabe. Si algo falla, el archivo ELEGIDO se conserva
   * y el reintento usa la misma ruta con `upsert`.
   */
  async function handleConfirmUpfront() {
    if (!file || busy || timing !== 'UPFRONT') return

    setPhase('preparing')
    try {
      // Import DINÁMICO: el compresor es la parte pesada del flujo y solo se
      // necesita acá (sacar el compresor y el picker del bundle inicial es un
      // requisito del plan).
      const { toVoucherJpeg } = await import('@/lib/images/compress-voucher')
      const blob = await toVoucherJpeg(file)

      setPhase('uploading')
      const supabase = createClient()
      const { error: uploadError } = await supabase.storage
        .from(PAYMENT_VOUCHER_BUCKET)
        .upload(paymentVoucherPath(orderId), blob, {
          upsert: true,
          contentType: 'image/jpeg',
          cacheControl: '0',
        })

      if (uploadError) {
        throw new Error(
          'No se pudo subir el comprobante. Revisa tu conexión e inténtalo de nuevo.'
        )
      }

      setPhase('confirming')
      await confirmDeliveryPayment(orderId, 'UPFRONT')
      success('Listo. Tu repartidor va por tu pedido.')
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
      className="animate-fade-up w-full min-w-0 rounded-3xl border border-amber-300/60 bg-amber-50/60 p-5 dark:border-amber-500/30 dark:bg-amber-500/10"
    >
      <div className="flex items-center gap-3">
        <DeliveryAvatar
          url={deliveryPerson.avatarUrl}
          name={deliveryPerson.fullName}
          size="lg"
          className="h-14 w-14 shrink-0 ring-2 ring-white dark:ring-neutral-900"
        />
        <div className="min-w-0">
          <h2 id="delivery-payment-heading" className="text-sm font-medium">
            {deliveryPerson.fullName} llevará tu pedido
          </h2>
          {/* La tarifa es EL dato de la tarjeta; el total a pagarle al
              repartidor (comida + envío, D1) vive en cada opción de pago, junto
              a la elección que decide — repetirlo acá era el mismo número tres
              veces en la misma pantalla. */}
          <p className="mt-1 flex flex-wrap items-baseline gap-x-1.5">
            <span className="text-xs text-amber-900 dark:text-amber-100">
              Costo de envío
            </span>
            <span className="text-lg font-semibold tabular-nums">S/ {fee}</span>
          </p>
        </div>
      </div>

      <div className="mt-5 border-t border-amber-300/60 pt-4 dark:border-amber-500/25">
        <PaymentMethodChoice
          timing={timing}
          onTimingChange={setTiming}
          disabled={busy}
          allowsOnDelivery={deliveryPerson.allowsPayOnDelivery}
          amount={due}
        />
      </div>

      {/* Ayuda visible mientras no haya elección y NINGÚN CTA: la decisión es
          del cliente y el camino que corresponde aún no existe. */}
      {timing === null && (
        <p className="mt-3 text-center text-xs text-amber-900 dark:text-amber-100">
          {PAYMENT_METHOD_PROMPT}
        </p>
      )}

      {timing === 'ON_DELIVERY' && (
        <div className="mt-4">
          <Button
            variant="lime"
            className="h-11 w-full"
            onClick={handleConfirmOnDelivery}
            disabled={busy}
          >
            {busy ? 'Confirmando…' : 'Confirmar pago al recibir'}
          </Button>
        </div>
      )}

      {timing === 'UPFRONT' && (
        <div className="mt-4">
          <YapePaymentPanel
            fullName={deliveryPerson.fullName}
            yapeQrUrl={deliveryPerson.yapeQrUrl}
            phone={deliveryPerson.phone}
            amount={due}
            file={file}
            onFileChange={setFile}
            busy={busy}
            busyLabel={phase === 'idle' ? undefined : PHASE_LABEL[phase]}
            onConfirm={handleConfirmUpfront}
          />
        </div>
      )}

      {/* Aviso de irrevocabilidad (D3), UNA sola vez y debajo del control que
          confirma: es la única fuente del texto en toda la pantalla. */}
      {timing !== null && (
        <p className="mt-3 text-center text-xs text-amber-900 dark:text-amber-100">
          {PAYMENT_METHOD_LOCK_NOTICE}
        </p>
      )}
    </section>
  )
}
