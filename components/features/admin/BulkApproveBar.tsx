'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CheckIcon, XIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import {
  approveDeliveriesBulk,
  approveRestaurantsBulk,
} from '@/lib/actions/admin'
import { ConfirmDialog } from './ConfirmDialog'

/**
 * Barra flotante de aprobación en lote (Fase 8). Aparece fija al fondo
 * cuando hay ≥1 fila seleccionada: "Aprobar seleccionados (N)" + botón
 * para deseleccionar. Compartida por RestaurantTable y DeliveryTable.
 *
 * El confirm intermedio es deliberado: aprobar N negocios a la vez es
 * una acción de alto impacto (activa también a sus dueños) y la barra
 * flotante invita al click accidental.
 */
export function BulkApproveBar({
  entity,
  selectedIds,
  onClear,
}: {
  entity: 'restaurants' | 'deliveries'
  selectedIds: string[]
  onClear: () => void
}) {
  const router = useRouter()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const { success, error } = useToast()

  const count = selectedIds.length
  if (count === 0) return null

  const isRestaurants = entity === 'restaurants'

  // ConfirmDialog pide onConfirm async (contrato con las acciones
  // individuales); aquí la transición ya maneja el async internamente.
  function handleConfirm(): Promise<void> {
    startTransition(async () => {
      try {
        const result = isRestaurants
          ? await approveRestaurantsBulk(selectedIds)
          : await approveDeliveriesBulk(selectedIds)
        setConfirmOpen(false)
        onClear()
        if (result.success) {
          success('Aprobación en lote completada', result.message)
        } else {
          error(result.message ?? 'No se pudo completar la acción')
        }
        router.refresh()
      } catch (err) {
        error(
          'No se pudo completar la acción',
          err instanceof Error ? err.message : undefined
        )
      }
    })
    return Promise.resolve()
  }

  return (
    <div className="fixed inset-x-0 bottom-6 z-40 mx-auto flex w-fit items-center gap-3 rounded-2xl border bg-background/95 px-4 py-2.5 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <span className="text-sm text-muted-foreground">
        {count} seleccionado{count === 1 ? '' : 's'}
      </span>
      <Button
        variant="lime"
        size="sm"
        onClick={() => setConfirmOpen(true)}
        disabled={isPending}
      >
        <CheckIcon className="h-4 w-4" />
        {isPending
          ? 'Aprobando…'
          : isRestaurants
            ? `Aprobar seleccionados (${count})`
            : `Aprobar seleccionados (${count})`}
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={onClear}
        disabled={isPending}
        title="Deseleccionar todo"
      >
        <XIcon className="h-4 w-4" />
      </Button>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={
          isRestaurants
            ? `Aprobar ${count} restaurante(s)`
            : `Aprobar ${count} repartidor(es)`
        }
        description={
          isRestaurants
            ? 'Se activarán los negocios seleccionados y las cuentas de sus dueños. Se registrará una única entrada en la auditoría con la lista de afectados.'
            : 'Se activarán los repartidores seleccionados para que puedan aceptar pedidos. Se registrará una única entrada en la auditoría con la lista de afectados.'
        }
        confirmLabel={isPending ? 'Aprobando…' : 'Aprobar'}
        variant="default"
        onConfirm={handleConfirm}
      />
    </div>
  )
}
