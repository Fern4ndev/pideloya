'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { confirmDeliveryPayment } from '@/lib/actions/orders'
import { DeliveryAvatar } from '@/components/features/admin/DeliveryAvatar'
import { PaymentMethodChoice } from '@/components/features/orders/PaymentMethodChoice'
import { CashPaymentPanel } from '@/components/features/orders/CashPaymentPanel'
import { YapeOnDeliveryPanel } from '@/components/features/orders/YapeOnDeliveryPanel'
import { useToast } from '@/components/ui/toast'
import { createClient } from '@/lib/db/client'
import { PAYMENT_VOUCHER_BUCKET, paymentVoucherPath } from '@/lib/constants/payment-voucher'
import {
  PAYMENT_METHOD_PROMPT,
  amountDueToCourier,
  type PaymentMethod,
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
 * la tupla de pago), así que en el HTML del servidor no hay nada que hidratar.
 * El `loading` reserva la altura (sin CLS).
 */
const YapePaymentPanel = dynamic(
  () => import('./YapePaymentPanel').then((m) => m.YapePaymentPanel),
  { ssr: false, loading: () => <YapePanelSkeleton /> }
)

/**
 * Tarjeta de pago del envío: aparece SOLO cuando el pedido está en
 * AWAITING_PAYMENT, cuando ya hay un repartidor con una tarifa propuesta
 * esperando que el cliente decida cómo le paga.
 *
 * Desde el plan "Pagar al recibir", la decisión tiene DOS EJES (D2):
 *
 *   ¿Cuándo?  → Pagar ahora (Yape + comprobante) | Pagar al recibir
 *   ¿Con qué? → (solo al recibir) Efectivo | Yape
 *
 * y la tupla elegida llega a la RPC select_delivery_payment completa. Los
 * paneles que se muestran según la tupla:
 *
 *   UPFRONT + YAPE      → YapePaymentPanel (QR, comprobante obligatorio)
 *   ON_DELIVERY + CASH  → CashPaymentPanel (como el ciclo anterior)
 *   ON_DELIVERY + YAPE  → YapeOnDeliveryPanel (nuevo, sin comprobante, D5)
 *
 * Decisiones heredadas que siguen sosteniendo el diseño:
 *
 * 1. SIN preselección en ningún nivel (D3): es dinero. El CTA solo existe con
 *    la tupla completa; mientras falta algo, se muestra la ayuda.
 * 2. La elección es DEFINITIVA (D3 del ciclo anterior). Se avisa antes del
 *    clic, en cada panel.
 * 3. Mientras hay una operación en curso (`phase !== 'idle'`), `busy` se
 *    DERIVA de `phase` (dos estados para la misma verdad pueden contradecirse)
 *    y el selector queda deshabilitado.
 * 4. El archivo del comprobante vive ACÁ y no dentro del panel: alternar a
 *    "al recibir" y volver a "Pagar ahora" no borra la captura ya elegida.
 * 5. Cambiar el "cuándo" limpia el "con qué" si la pareja dejó de tener
 *    sentido (de UPFRONT no hay método; al volver a UPFRONT no hay nada que
 *    conservar porque el panel de Yape-ahora no usa `method`).
 */
export function DeliveryPaymentCard({
  orderId,
  total,
  deliveryPerson,
}: {
  orderId: string
  /** Total del pedido (comida). En TODOS los métodos (D1) el cliente le paga
   *  al repartidor este monto MÁS el envío. */
  total: number
  deliveryPerson: DeliveryOffer
}) {
  const router = useRouter()
  const { error, success } = useToast()
  const [timing, setTiming] = useState<PaymentTiming | null>(null)
  const [method, setMethod] = useState<PaymentMethod | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [phase, setPhase] = useState<Phase>('idle')

  const fee = deliveryPerson.deliveryFee.toFixed(2)
  const due = amountDueToCourier(total, deliveryPerson.deliveryFee).toFixed(2)
  const busy = phase !== 'idle'
  const tupleComplete =
    timing !== null && (timing === 'UPFRONT' || method !== null)

  /** Nivel 1: al cambiar el "cuándo" se desmonta el sub-grupo y el "con qué"
   *  deja de existir salvo que siga siendo ON_DELIVERY (donde se conserva:
   *  alternar dos veces no debe borrar lo ya elegido). */
  function handleTimingChange(next: PaymentTiming) {
    setTiming(next)
    if (next !== 'ON_DELIVERY') setMethod(null)
  }

  /** Efectivo al recibir: no hay archivo que subir ni nada que verificar. La
   *  Server Action valida la tupla y la función SQL vuelve a validarla. */
  async function handleConfirmCash() {
    if (busy || timing !== 'ON_DELIVERY' || method !== 'CASH') return
    setPhase('confirming')
    try {
      await confirmDeliveryPayment(orderId, { method: 'CASH', timing: 'ON_DELIVERY' })
      success(
        '¡Listo! Tu repartidor ya puede ir por tu pedido.',
        `Pagarás S/ ${due} en efectivo cuando te lo entregue.`
      )
      router.refresh()
    } catch (err) {
      error('No se pudo confirmar', err instanceof Error ? err.message : undefined)
    } finally {
      setPhase('idle')
    }
  }

  /** Yape AL RECIBIR: solo se anuncia la promesa (D5, sin comprobante). */
  async function handleConfirmYapeOnDelivery() {
    if (busy || timing !== 'ON_DELIVERY' || method !== 'YAPE') return
    setPhase('confirming')
    try {
      await confirmDeliveryPayment(orderId, { method: 'YAPE', timing: 'ON_DELIVERY' })
      success(
        '¡Listo! Tu repartidor ya puede ir por tu pedido.',
        `Yapearás S/ ${due} cuando te entregue el pedido.`
      )
      router.refresh()
    } catch (err) {
      error('No se pudo confirmar', err instanceof Error ? err.message : undefined)
    } finally {
      setPhase('idle')
    }
  }

  /**
   * Yape POR ADELANTADO: sube el comprobante y recién después confirma. El
   * orden no es negociable: la función SQL rechaza la confirmación si el
   * archivo no existe en Storage.
   *
   * El archivo sube DIRECTO del navegador a Storage con la sesión del cliente
   * (RLS aplicada): las Server Actions tienen un límite de cuerpo de 1 MB y un
   * comprobante no siempre cabe. Si algo falla, el archivo ELEGIDO se conserva
   * y el reintento usa la misma ruta con `upsert`.
   */
  async function handleConfirmYapeUpfront() {
    if (!file || busy || timing !== 'UPFRONT') return

    setPhase('preparing')
    try {
      // Import DINÁMICO: el compresor es la parte pesada del flujo y solo se
      // necesita acá (la Fase 4.6 del plan pide sacarlo del bundle inicial).
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
      await confirmDeliveryPayment(orderId, { method: 'YAPE', timing: 'UPFRONT' })
      success('¡Listo! Tu repartidor ya puede ir por tu pedido.')
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
          {/* La tarifa sube de `text-xs` a `text-lg`: es EL dato que el cliente
              necesita para decidir. El total a pagarle al repartidor (comida +
              envío, D1) se agrega como segunda línea: los tres paneles lo
              repiten, pero es el número que decide la elección. */}
          <p className="mt-1 flex flex-wrap items-baseline gap-x-1.5">
            <span className="text-xs text-amber-900 dark:text-amber-100">
              Costo de envío
            </span>
            <span className="text-lg font-semibold tabular-nums">S/ {fee}</span>
          </p>
          <p className="text-xs text-amber-900 dark:text-amber-100">
            Total a pagarle al repartidor: S/ {due}
          </p>
        </div>
      </div>

      <div className="mt-5 border-t border-amber-300/60 pt-4 dark:border-amber-500/25">
        <PaymentMethodChoice
          timing={timing}
          method={method}
          onTimingChange={handleTimingChange}
          onMethodChange={setMethod}
          disabled={busy}
          allowsOnDelivery={deliveryPerson.allowsPayOnDelivery}
        />
      </div>

      {/* Ayuda visible mientras la tupla esté incompleta y NINGÚN CTA: la
          decisión es del cliente y el panel que corresponde aún no existe. */}
      {!tupleComplete && (
        <p className="mt-3 text-center text-xs text-amber-900 dark:text-amber-100">
          {PAYMENT_METHOD_PROMPT}
        </p>
      )}

      {timing === 'ON_DELIVERY' && method === 'CASH' && (
        <div className="mt-4">
          <CashPaymentPanel amount={due} onConfirm={handleConfirmCash} busy={busy} />
        </div>
      )}

      {timing === 'ON_DELIVERY' && method === 'YAPE' && (
        <div className="mt-4">
          <YapeOnDeliveryPanel
            fullName={deliveryPerson.fullName}
            yapeQrUrl={deliveryPerson.yapeQrUrl}
            phone={deliveryPerson.phone}
            amount={due}
            busy={busy}
            onConfirm={handleConfirmYapeOnDelivery}
          />
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
            onConfirm={handleConfirmYapeUpfront}
          />
        </div>
      )}
    </section>
  )
}
