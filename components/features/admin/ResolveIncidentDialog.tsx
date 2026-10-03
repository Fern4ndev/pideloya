'use client'

import { useState, useTransition } from 'react'
import { resolvePaymentIncident } from '@/lib/actions/admin'
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
import { PAYMENT_INCIDENT_KIND_COPY } from '@/lib/constants/payment-incident'

/**
 * Resolver una incidencia de pago (Fase 8.3).
 *
 * No mueve dinero ni cambia el estado del pedido: marca la incidencia como
 * atendida y guarda la nota interna del admin en la entrada de auditoría
 * (`admin_audit_log.metadata.note`), que es donde se registra la gestión. El
 * texto de la nota NO se guarda en `payment_incidents` — la tabla es la
 * bandeja, la bitácora es la auditoría.
 *
 * `ConfirmDialog` no sirve acá porque su contrato no acepta campos: la nota es
 * el dato que justifica la resolución.
 */
export function ResolveIncidentDialog({
  open,
  onOpenChange,
  incident,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  incident: { id: string; orderRef: string; kind: string; reporterName: string | null } | null
}) {
  const [note, setNote] = useState('')
  const [isPending, startTransition] = useTransition()
  const { success, error } = useToast()

  function handleConfirm() {
    if (!incident || isPending) return
    startTransition(async () => {
      try {
        const result = await resolvePaymentIncident(incident.id, note)
        if (result?.success === false) {
          // Otro admin la resolvió primero: no es un error técnico, es un
          // estado que el diálogo tiene que decir en vez de fingir un éxito.
          error(result.message ?? 'No se pudo resolver la incidencia')
          onOpenChange(false)
          return
        }
        onOpenChange(false)
        success(result?.message ?? 'Incidencia resuelta')
      } catch (err) {
        error(
          'No se pudo resolver la incidencia',
          err instanceof Error ? err.message : undefined
        )
      }
    })
  }

  function handleOpenChange(next: boolean) {
    if (next) setNote('')
    onOpenChange(next)
  }

  if (!incident) return null

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Resolver incidencia</DialogTitle>
          <DialogDescription>
            Pedido {incident.orderRef} ·{' '}
            {PAYMENT_INCIDENT_KIND_COPY[
              incident.kind as keyof typeof PAYMENT_INCIDENT_KIND_COPY
            ] ?? incident.kind}
            {incident.reporterName ? ` · reportó ${incident.reporterName}` : ''}. Resolver marca
            el reporte como atendido: no mueve dinero ni cambia el pedido.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <label htmlFor="incident-resolution-note" className="text-sm font-medium">
            Nota interna (queda en auditoría)
          </label>
          <Textarea
            id="incident-resolution-note"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            disabled={isPending}
            maxLength={500}
            rows={3}
            placeholder="Qué se verificó y con quién se habló."
          />
          <p className="text-xs text-muted-foreground">{note.length}/500</p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={isPending}>
            Cancelar
          </Button>
          <Button variant="lime" onClick={handleConfirm} disabled={isPending}>
            {isPending ? 'Resolviendo…' : 'Marcar como resuelta'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
