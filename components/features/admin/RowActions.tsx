'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { PencilIcon, TrashIcon, CheckIcon, XIcon } from 'lucide-react'
import { ConfirmDialog } from './ConfirmDialog'

type RowActionsProps = {
  isActive: boolean
  isApproved?: boolean
  onApprove?: () => Promise<{ success: boolean }>
  onEdit: () => void
  onToggleActive: () => Promise<{ success: boolean }>
  onDelete: () => Promise<{ success: boolean }>
  entityName: string
}

export function RowActions({
  isActive,
  isApproved,
  onApprove,
  onEdit,
  onToggleActive,
  onDelete,
  entityName,
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

  function handleToggleActive() {
    setConfirmConfig({
      title: isActive ? `Desactivar ${entityName}` : `Activar ${entityName}`,
      description: isActive
        ? `¿Estás seguro de desactivar este ${entityName}? No podrá acceder al panel.`
        : `¿Estás seguro de activar este ${entityName}? Podrá acceder al panel nuevamente.`,
      confirmLabel: isActive ? 'Desactivar' : 'Activar',
      variant: isActive ? 'destructive' : 'default',
      action: onToggleActive,
    })
    setConfirmOpen(true)
  }

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
          onClick={handleToggleActive}
          disabled={isPending}
          title={isActive ? 'Desactivar' : 'Activar'}
        >
          {isActive ? (
            <XIcon className="h-4 w-4 text-orange-500" />
          ) : (
            <CheckIcon className="h-4 w-4 text-green-600" />
          )}
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
