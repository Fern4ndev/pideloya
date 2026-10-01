'use client'

import { useState, useTransition } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/components/ui/toast'
import { reportPaymentIncident } from '@/lib/actions/payment-incidents'
import {
  PAYMENT_INCIDENT_KIND_COPY,
  type PaymentIncidentKind,
} from '@/lib/constants/payment-incident'
import { cn } from '@/lib/utils'

/**
 * Diálogo corto de incidencia de pago (Fase 8, D8): lo usan el repartidor
 * ("No pude cobrar") y el restaurante ("Reportar problema con el pago").
 *
 * Decisiones:
 *
 * 1. **No cambia el estado del pedido.** Reportar NO es una salida del flujo:
 *    el repartidor sigue en `ON_THE_WAY` y puede reintentar el cobro o esperar
 *    a soporte. La incidencia es evidencia para el admin, no una puerta.
 * 2. **Un solo tipo cuando el rol tiene uno solo** (`kinds.length === 1`, el
 *    caso del restaurante): se explica el hecho en texto en vez de mostrar un
 *    grupo de radios con una única opción, que parece un error de UI.
 * 3. **La nota es opcional** y su límite (500) es el mismo del CHECK de la
 *    tabla y del RPC: se refuerza con `maxLength` para no depender del error
 *    del servidor, pero el servidor sigue siendo el que manda.
 * 4. La autorización real vive en `report_payment_incident()`: si esta UI se
 *    forzara desde DevTools, la función rechaza por rol o por no ser parte del
 *    pedido. Acá no se duplican reglas.
 */
export function PaymentIncidentDialog({
  open,
  onOpenChange,
  orderId,
  kinds,
  title = '¿Qué pasó?',
  description,
  submitLabel = 'Enviar reporte',
  successTitle = 'Registramos tu reporte.',
  successDescription = 'Soporte lo revisará.',
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  orderId: string
  /** Tipos ofrecidos, en orden de la lista (la whitelist la valida el RPC). */
  kinds: readonly PaymentIncidentKind[]
  title?: string
  description?: string
  submitLabel?: string
  successTitle?: string
  successDescription?: string
}) {
  const [kind, setKind] = useState<PaymentIncidentKind>(kinds[0])
  const [note, setNote] = useState('')
  const [isPending, startTransition] = useTransition()
  const { success, error } = useToast()

  // Cada apertura arranca limpia: reusar la nota O el tipo de un reporte
  // anterior es la forma más fácil de mandar un dato falso.
  function handleOpenChange(next: boolean) {
    if (next) {
      setKind(kinds[0])
      setNote('')
    }
    onOpenChange(next)
  }

  function handleSubmit() {
    if (isPending) return
    startTransition(async () => {
      try {
        await reportPaymentIncident(orderId, kind, note.trim() || undefined)
        onOpenChange(false)
        success(successTitle, successDescription)
      } catch (err) {
        error('No se pudo registrar el reporte', err instanceof Error ? err.message : undefined)
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {description ??
              'Registramos el hecho para que soporte lo revise. El pedido sigue como está.'}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] space-y-4 overflow-y-auto">
          {kinds.length > 1 ? (
            /* Radios NATIVOS (mismo patrón que PaymentMethodChoice): flechas de
               teclado, agrupación por `name` y anuncio "opción 1 de 3" son del
               navegador; un div con role="radio" habría que reimplementarlos. */
            <fieldset className="min-w-0">
              <legend className="text-sm font-medium">Motivo</legend>
              <div className="mt-2 space-y-2">
                {kinds.map((option) => {
                  const selected = kind === option
                  return (
                    <label key={option} className="block cursor-pointer">
                      <input
                        type="radio"
                        name="incident-kind"
                        value={option}
                        checked={selected}
                        onChange={() => setKind(option)}
                        disabled={isPending}
                        className="peer sr-only"
                      />
                      <span
                        className={cn(
                          'flex min-h-12 items-center rounded-2xl border px-3 text-sm font-medium transition-colors',
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
                        {PAYMENT_INCIDENT_KIND_COPY[option]}
                      </span>
                    </label>
                  )
                })}
              </div>
            </fieldset>
          ) : (
            <p className="rounded-2xl border border-amber-300/60 bg-amber-50/60 px-4 py-3 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
              {PAYMENT_INCIDENT_KIND_COPY[kind]}
            </p>
          )}

          <div className="space-y-2">
            <label htmlFor="incident-note" className="text-sm font-medium">
              Detalle (opcional)
            </label>
            <Textarea
              id="incident-note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              disabled={isPending}
              maxLength={500}
              rows={3}
              placeholder="Cuéntanos brevemente qué pasó."
            />
            <p className="text-xs text-muted-foreground">
              {note.length}/500
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={isPending}>
            Cancelar
          </Button>
          <Button variant="lime" onClick={handleSubmit} disabled={isPending}>
            {isPending ? 'Enviando…' : submitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
