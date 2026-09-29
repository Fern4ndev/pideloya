'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { confirmDeliveryPayment } from '@/lib/actions/orders'
import { DeliveryAvatar } from '@/components/features/admin/DeliveryAvatar'
import { PaymentMethodChoice } from '@/components/features/orders/PaymentMethodChoice'
import { CashPaymentPanel } from '@/components/features/orders/CashPaymentPanel'
import { useToast } from '@/components/ui/toast'
import { createClient } from '@/lib/db/client'
import { PAYMENT_VOUCHER_BUCKET, paymentVoucherPath } from '@/lib/constants/payment-voucher'
import {
  PAYMENT_METHOD_PROMPT,
  cashAmountDue,
  type PaymentMethod,
} from '@/lib/constants/payment-method'

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
 * Carga diferida del panel de Yape (Fase 4.3 del plan): quien va a pagar en
 * efectivo nunca necesita el QR, el QR ampliable, el selector de archivos ni el
 * compresor de imágenes, así que no tiene por qué descargarlos para decidir.
 *
 * `ssr: false` es correcto acá y no un atajo: el panel solo existe después de
 * una interacción del cliente (elegir un método), así que en el HTML del
 * servidor no hay nada que hidratar. El `loading` reserva la altura.
 */
const YapePaymentPanel = dynamic(
  () => import('./YapePaymentPanel').then((m) => m.YapePaymentPanel),
  { ssr: false, loading: () => <YapePanelSkeleton /> }
)

/**
 * Tarjeta de pago del envío: aparece SOLO cuando el pedido está en
 * AWAITING_PAYMENT, es decir cuando ya hay un repartidor con una tarifa
 * propuesta esperando que el cliente decida cómo le paga.
 *
 * Desde la Fase 4 del plan del método de pago, el cliente tiene UNA DECISIÓN y
 * después UNA TAREA:
 *
 *   ¿Cómo quieres pagar el envío?  →  Pagar al recibir (efectivo)
 *                                  →  Pagar ahora (Yape + comprobante)
 *
 * Antes había un solo camino (Yape + comprobante obligatorio) y los tres pasos
 * de Yape se le mostraban también a quien iba a pagar en efectivo. Ahora los
 * pasos aparecen recién cuando eligen "Pagar ahora": revelado progresivo, una
 * acción primaria por estado.
 *
 * Decisiones que no son cosméticas (D2 y D5 del plan):
 *
 * 1. SIN opción preseleccionada: es dinero. Preseleccionar Yape empuja a subir
 *    un comprobante a quien quería efectivo; preseleccionar efectivo se presta
 *    a confirmar por inercia. Mientras no haya elección se muestra una ayuda
 *    visible y NINGÚN botón.
 * 2. La elección es DEFINITIVA (el pedido sale de AWAITING_PAYMENT y arranca).
 *    Se avisa antes del clic, en el panel del método elegido.
 * 3. Mientras hay una operación en curso (`phase !== 'idle'`) el selector queda
 *    deshabilitado: cambiar de método a mitad de una subida dejaría la promesa
 *    en vuelo sin ninguna UI que la espere.
 * 4. El archivo elegido vive ACÁ y no dentro del panel de Yape: si viviera
 *    dentro, alternar curiosa y brevemente a efectivo y volver a Yape borraría
 *    la captura y obligaría a buscarla otra vez en la galería.
 * 5. `busy` se DERIVA de `phase` en vez de guardarse: dos estados para la misma
 *    verdad pueden contradecirse (botón deshabilitado con fase en idle).
 *
 * El contraste de los textos pequeños de la tarjeta está medido, no estimado:
 * usan `amber-900` (~8.9:1 sobre el fondo ámbar) en vez de `muted-foreground`,
 * que sobre este fondo queda en ~4.7:1 — pasa, pero sin margen para que un
 * cambio de token lo rompa en silencio.
 */
export function DeliveryPaymentCard({
  orderId,
  total,
  deliveryPerson,
}: {
  orderId: string
  /** Total del pedido (comida). Con efectivo (D1) el cliente le paga al
   *  repartidor este monto MÁS el envío, así que se muestra la suma. */
  total: number
  deliveryPerson: DeliveryOffer
}) {
  const router = useRouter()
  const { error, success } = useToast()
  const [method, setMethod] = useState<PaymentMethod | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [phase, setPhase] = useState<Phase>('idle')

  const fee = deliveryPerson.deliveryFee.toFixed(2)
  const cashDue = cashAmountDue(total, deliveryPerson.deliveryFee).toFixed(2)
  const busy = phase !== 'idle'

  /** Efectivo: no hay archivo que subir ni nada que verificar antes. La Server
   *  Action valida el método y la función SQL exige que la ruta del comprobante
   *  vaya vacía, así que acá solo se confirma la elección. */
  async function handleConfirmCash() {
    if (busy) return
    setPhase('confirming')
    try {
      await confirmDeliveryPayment(orderId, 'CASH')
      success(
        '¡Listo! Tu repartidor ya puede ir por tu pedido.',
        `Pagarás S/ ${cashDue} en efectivo cuando te lo entregue.`
      )
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

  /**
   * Yape: sube el comprobante y recién después confirma el pago. El orden no es
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
  async function handleConfirmYape() {
    if (!file || busy) return

    setPhase('preparing')
    try {
      // Import DINÁMICO y no estático: el compresor (y su decodificación de
      // imágenes) es la parte pesada del flujo y solo se necesita acá. Con un
      // import estático entraría en el bundle inicial de la página, que es lo
      // que la Fase 4.6 pide evitar.
      const { toVoucherJpeg } = await import('@/lib/images/compress-voucher')
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
      await confirmDeliveryPayment(orderId, 'YAPE')
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
              necesita para pagar, no una nota al pie. */}
          <p className="mt-1 flex flex-wrap items-baseline gap-x-1.5">
            <span className="text-xs text-amber-900 dark:text-amber-100">
              Costo de envío
            </span>
            <span className="text-lg font-semibold tabular-nums">S/ {fee}</span>
          </p>
        </div>
      </div>

      <div className="mt-5 border-t border-amber-300/60 pt-4 dark:border-amber-500/25">
        <PaymentMethodChoice value={method} onChange={setMethod} disabled={busy} />
      </div>

      {/* Ayuda visible mientras no hay elección y NINGÚN CTA: la decisión es del
          cliente y el panel que corresponde todavía no existe. */}
      {method === null && (
        <p className="mt-3 text-center text-xs text-amber-900 dark:text-amber-100">
          {PAYMENT_METHOD_PROMPT}
        </p>
      )}

      {method === 'CASH' && (
        <div className="mt-4">
          <CashPaymentPanel amount={cashDue} onConfirm={handleConfirmCash} busy={busy} />
        </div>
      )}

      {method === 'YAPE' && (
        <div className="mt-4">
          <YapePaymentPanel
            fullName={deliveryPerson.fullName}
            yapeQrUrl={deliveryPerson.yapeQrUrl}
            phone={deliveryPerson.phone}
            fee={fee}
            file={file}
            onFileChange={setFile}
            busy={busy}
            busyLabel={phase === 'idle' ? undefined : PHASE_LABEL[phase]}
            onConfirm={handleConfirmYape}
          />
        </div>
      )}
    </section>
  )
}
