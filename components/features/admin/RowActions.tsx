'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { PencilIcon, TrashIcon, CheckIcon } from 'lucide-react'
import { ConfirmDialog } from './ConfirmDialog'

type RowActionsProps = {
  isApproved?: boolean
  onApprove?: () => Promise<{ success: boolean }>
  onEdit: () => void
  onDelete: () => Promise<{ success: boolean }>
  entityName: string
  renderSwitch?: React.ReactNode
}

export function RowActions({
  isApproved,
  onApprove,
  onEdit,
  onDelete,
  entityName,
  renderSwitch,
}: RowActionsProps) {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmConfig, setConfirmConfig] = useState<{
    title: string
    description: string
    confirmLabel: string
    variant: 'destructive' | 'default'
    action: () => Promise<{ success: boolean }>
  } | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleDelete() {
    setConfirmConfig({
      title: `Eliminar ${entityName}`,
      description: `¿Estás seguro de eliminar este ${entityName}? Esta acción no se puede deshacer.`,
      confirmLabel: 'Eliminar',
      variant: 'destructive',
      action: onDelete,
    })
    setConfirmOpen(true)
  }

  function handleApprove() {
    if (!onApprove) return
    startTransition(() => {
      onApprove()
    })
  }

  return (
    <>
      <div className="flex items-center gap-1">
        {renderSwitch}
        {onApprove && !isApproved && (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={handleApprove}
            disabled={isPending}
            title="Aprobar"
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
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={handleDelete}
          title="Eliminar"
        >
          <TrashIcon className="h-4 w-4 text-destructive" />
        </Button>
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
