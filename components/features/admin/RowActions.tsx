'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { PencilIcon, TrashIcon, CheckIcon } from 'lucide-react'
import { ConfirmDialog } from './ConfirmDialog'

type RowActionsProps = {
  onApprove?: () => Promise<{ success: boolean; message?: string }>
  onEdit: () => void
  onDelete?: () => Promise<{ success: boolean; message?: string }>
  entityName: string
  approveLabel?: string
  deleteTitle?: string
  deleteDescription?: string
  deleteConfirmLabel?: string
  deleteIcon?: React.ReactNode
}

export function RowActions({
  onApprove,
  onEdit,
  onDelete,
  entityName,
  approveLabel = 'Aprobar',
  deleteTitle,
  deleteDescription,
  deleteConfirmLabel,
  deleteIcon,
}: RowActionsProps) {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmConfig, setConfirmConfig] = useState<{
    title: string
    description: string
    confirmLabel: string
    variant: 'destructive' | 'default'
    action: () => Promise<{ success: boolean; message?: string }>
  } | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleDelete() {
    if (!onDelete) return
    setConfirmConfig({
      title: deleteTitle ?? `Eliminar ${entityName}`,
      description:
        deleteDescription ??
        `¿Estás seguro de eliminar este ${entityName}? Esta acción no se puede deshacer.`,
      confirmLabel: deleteConfirmLabel ?? 'Eliminar',
      variant: 'destructive',
      action: onDelete,
    })
    setConfirmOpen(true)
  }

  function handleApprove() {
    if (!onApprove) return
    startTransition(async () => {
      try {
        const result = await onApprove()
        toast.success(result.message ?? 'Operación completada')
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : 'No se pudo completar la acción'
        )
      }
    })
  }

  return (
    <>
      <div className="flex items-center gap-1">
        {onApprove && (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={handleApprove}
            disabled={isPending}
            title={approveLabel}
          >
            <CheckIcon className="h-4 w-4 text-green-600" />
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onEdit}
          title="Editar"
        >
          <PencilIcon className="h-4 w-4" />
        </Button>
        {onDelete && (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={handleDelete}
            title={deleteConfirmLabel ?? 'Eliminar'}
          >
            {deleteIcon ?? <TrashIcon className="h-4 w-4 text-destructive" />}
          </Button>
        )}
      </div>

      {confirmConfig && (
        <ConfirmDialog
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          title={confirmConfig.title}
          description={confirmConfig.description}
          confirmLabel={confirmConfig.confirmLabel}
          variant={confirmConfig.variant}
          onConfirm={confirmConfig.action}
        />
      )}
    </>
  )
}
