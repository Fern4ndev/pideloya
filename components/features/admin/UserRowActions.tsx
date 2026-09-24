'use client'

import { useState } from 'react'
import { EyeIcon, TrashIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { deleteUser } from '@/lib/actions/admin'
import { ConfirmDialog } from './ConfirmDialog'
import { ViewUserDialog, type UserSummary } from './ViewUserDialog'

export function UserRowActions({ user }: { user: UserSummary }) {
  const [viewOpen, setViewOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)

  return (
    <>
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => setViewOpen(true)}
          title="Inspeccionar"
        >
          <EyeIcon className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => setConfirmOpen(true)}
          title="Eliminar"
        >
          <TrashIcon className="h-4 w-4 text-destructive" />
        </Button>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Eliminar cliente"
        description="¿Eliminar esta cuenta? El cliente ya no podrá iniciar sesión, pero su historial de pedidos se conservará. Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        variant="destructive"
        onConfirm={async () => {
          const result = await deleteUser(user.id)
          return { ...result, message: 'Cliente eliminado' }
        }}
      />

      <ViewUserDialog open={viewOpen} onOpenChange={setViewOpen} user={user} />
    </>
  )
}
