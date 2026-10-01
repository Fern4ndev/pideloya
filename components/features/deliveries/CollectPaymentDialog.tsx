'use client'

import { useState, useTransition } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import { advanceOrderStatus } from '@/lib/actions/deliveries'
import { PaymentIncidentDialog } from '@/components/features/orders/PaymentIncidentDialog'
import { COURIER_INCIDENT_KINDS } from '@/lib/constants/payment-incident'
import { cn } from '@/lib/utils'
import type { PaymentMethod } from '@/lib/constants/payment-method'

/**
 * Selector segmentado Yape/Efectivo del diálogo de cobro. Radios NATIVOS con
 * el mismo patrón que `PaymentMethodChoice` (input `sr-only` + anillo pintado
 * con `peer-focus-visible` en la tarjeta visible): flechas de teclado,
 * agrupación por `name` y anuncio "opción 1 de 2" son comportamiento del
 * navegador; un div con role="radio" obligaría a reimplementarlos.
 *
 * Aquí SÍ hay preselección, a diferencia del cliente (D3): el repartidor no está
 * decidiendo con dinero ajeno, está CONFIRMANDO un hecho que acaba de pasar — y
 * lo que el cliente anunció es la hipótesis más probable. Siempre puede
 * corregirla con un toque (D4: lo que cuenta es lo que declara).
 *
 * Objetivo táctil: la tarjeta completa (`min-h-12` = 48 px), no el círculo.
 */
function CollectMethodChoice({
  value,
  onChange,
  disabled,
}: {
  value: PaymentMethod
  onChange: (method: PaymentMethod) => void
  disabled?: boolean
}) {
  return (
    <fieldset disabled={disabled} className="min-w-0">
      <legend className="text-sm font-medium">¿Cómo te pagó?</legend>
      <div className="mt-2 grid grid-cols-2 gap-2">
        {(['YAPE', 'CASH'] as const).map((method) => {
          const selected = value === method
          return (
            <label key={method} className="block cursor-pointer">
              <input
                type="radio"
                name="collected-method"
                value={method}
                checked={selected}
                onChange={() => onChange(method)}
                className="peer sr-only"
              />
              <span
                className={cn(
                  'flex min-h-12 items-center justify-center gap-2 rounded-2xl border px-3 text-sm font-medium transition-colors',
                  'border-black/10 bg-white dark:border-white/10 dark:bg-white/5',
                  'peer-checked:border-amber-600 peer-checked:bg-amber-100/60',
                  'dark:peer-checked:border-amber-400/70 dark:peer-checked:bg-amber-500/15',
                  'peer-focus-visible:outline peer-focus-visible:outline-2',
                  'peer-focus-visible:outline-offset-2 peer-focus-visible:outline-lime',
                  // Halo medido (globals.css): el lima solo mide 1.15:1 sobre blanco.
                  'peer-focus-visible:focus-halo',
                  'peer-disabled:cursor-default peer-disabled:opacity-70'
                )}
              >
                {method === 'YAPE' ? 'Yape' : 'Efectivo'}
              </span>
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}

/**
 * Diálogo "¿Cómo te pagó?": la puerta de salida ON_THE_WAY -> DELIVERED cuando
 * el pedido se paga AL RECIBIR (cualquier método, no solo efectivo).
 *
 * Reemplaza al ConfirmDialog de efectivo del ciclo anterior. Tres decisiones:
 *
 * 1. **Atestación obligatoria (checkbox)** y no solo un botón: un toque
 *    accidental en la puerta no debe cerrar la entrega; y la atestación es la
 *    constancia de que ÉL declaró haber cobrado — la base de cualquier disputa
 *    (D4). El botón queda deshabilitado hasta marcarla y un texto lo explica.
 * 2. **Aviso honesto de una línea**: PideloYa NO verifica el yapeo (no hay
 *    integración bancaria); la verificación real la hace el repartidor en su
 *    propia app. La UI nunca promete más de lo que el sistema hace.
 * 3. La guarda REAL no vive acá: si la UI fallara (otra pestaña, la API),
 *    complete_delivery() responde 22000 y el toast lo muestra — nunca queda un
 *    "entregado" sin constancia de cobro.
 *
 * Acción secundaria (Fase 8): **"No pude cobrar"** abre el diálogo de
 * incidencia (D8) con los tres motivos del repartidor. NO cierra la entrega ni
 * cambia el estado — el pedido sigue `ON_THE_WAY` y el repartidor puede
 * reintentar. El reporte queda como evidencia para soporte.
 */
export function CollectPaymentDialog({
  open,
  onOpenChange,
  orderId,
  announcedMethod,
  amount,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  orderId: string
  /** Lo que el cliente ANUNCIÓ al confirmar el pedido (preselección, D4). */
  announcedMethod: PaymentMethod
  /** Monto a cobrar, ya formateado con dos decimales (ej. "27.50"). */
  amount: string
}) {
  const [method, setMethod] = useState<PaymentMethod>(announcedMethod)
  const [attested, setAttested] = useState(false)
  const [incidentOpen, setIncidentOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const { success, error } = useToast()

  // Los dos diálogos NO se montan abiertos a la vez: al abrir la incidencia se
  // cierra el de cobro (mismo componente, sigue montado porque el padre siempre
  // lo renderiza). Así se evita apilar diálogos y el foco queda en uno solo.

  // Re-abrir el diálogo tras un error no debe conservar una atestación vieja
  // ni el método de un intento anterior: cada cobro se confirma desde cero.
  function handleOpenChange(next: boolean) {
    if (next) {
      setMethod(announcedMethod)
      setAttested(false)
    }
    onOpenChange(next)
  }

  function handleConfirm() {
    if (!attested || isPending) return
    startTransition(async () => {
      try {
        await advanceOrderStatus(orderId, 'ON_THE_WAY', {
          collected: true,
          collectedMethod: method,
        })
        onOpenChange(false)
        success(
          'Entrega registrada.',
          method === 'YAPE'
            ? 'Quedó constancia del cobro por Yape.'
            : 'Quedó constancia del cobro en efectivo.'
        )
      } catch (err) {
        error('No se pudo confirmar', err instanceof Error ? err.message : undefined)
      }
    })
  }

  const attestationText =
    method === 'YAPE'
      ? `Ya vi el yapeo de S/ ${amount} en mi app de Yape.`
      : `Ya recibí S/ ${amount} en efectivo.`

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>¿Cómo te pagó?</DialogTitle>
          <DialogDescription>
            Cobra antes de entregar. Registra el medio REAL: si difiere de lo que
            el cliente anunció, está bien — queda registrado tal cual.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-2xl border border-amber-300/60 bg-amber-50/60 px-4 py-3 dark:border-amber-500/30 dark:bg-amber-500/10">
            {/* Monto tabular text-2xl: es el dato que se contrasta contra la app
                de Yape o contra los billetes en la mano. */}
            <p className="text-2xl font-bold tabular-nums text-amber-900 dark:text-amber-100">
              S/ {amount}
            </p>
            <p className="text-xs text-amber-900 dark:text-amber-100">
              Comida + envío. El cliente indicó:{' '}
              {announcedMethod === 'YAPE' ? 'Yape' : 'efectivo'}.
            </p>
          </div>

          <CollectMethodChoice value={method} onChange={setMethod} disabled={isPending} />

          {/* Checkbox NATIVO (no botón toggle): semántica de "declaro", estado
              accesible y objetivo táctil completo en la etiqueta. */}
          <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-2xl border border-black/5 p-3 text-sm dark:border-white/10">
            <input
              type="checkbox"
              checked={attested}
              onChange={(e) => setAttested(e.target.checked)}
              disabled={isPending}
              className="mt-0.5 focus-visible:outline-offset-2 focus-visible:focus-halo h-5 w-5 shrink-0 rounded border-black/45 accent-amber-600 dark:border-white/45 dark:accent-amber-400"
            />
            <span className="min-w-0">{attestationText}</span>
          </label>

          <p className="text-xs text-muted-foreground">
            PideloYa no puede verificar el pago: confirma en tu app de Yape o en
            el efectivo en mano antes de entregar.
          </p>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              onOpenChange(false)
              setIncidentOpen(true)
            }}
            disabled={isPending}
          >
            No pude cobrar
          </Button>
          <Button variant="lime" onClick={handleConfirm} disabled={!attested || isPending}>
            {isPending ? 'Confirmando…' : 'Confirmar cobro y entregar'}
          </Button>
        </DialogFooter>

        {/* El estado deshabilitado del CTA se explica SIEMPRE: un botón gris
            sin motivo es un callejón sin salida en la puerta del cliente. */}
        {!attested && (
          <p className="text-center text-xs text-amber-900 dark:text-amber-100">
            Marca la casilla para confirmar que ya te pagó.
          </p>
        )}
      </DialogContent>

      {/* Hermano del diálogo de cobro, nunca anidado dentro: el pedido NO pasa a
          DELIVERED al reportar (D8) — el repartidor sigue en ON_THE_WAY. */}
      <PaymentIncidentDialog
        open={incidentOpen}
        onOpenChange={setIncidentOpen}
        orderId={orderId}
        kinds={COURIER_INCIDENT_KINDS}
        title="No pude cobrar"
        description="Cuéntanos qué pasó. El pedido sigue en camino: puedes reintentar el cobro o esperar a soporte."
        submitLabel="Registrar reporte"
        successTitle="Registramos tu reporte."
        successDescription="Soporte lo revisará. El pedido sigue en camino."
      />
    </Dialog>
  )
}
