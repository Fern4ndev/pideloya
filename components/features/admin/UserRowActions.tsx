'use client'

import { useState } from 'react'
import { EyeIcon, TrashIcon, UserXIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { deleteUser } from '@/lib/actions/admin'
import { ConfirmDialog } from './ConfirmDialog'
import { ViewUserDialog, type UserSummary } from './ViewUserDialog'

export function UserRowActions({
  user,
  hasHistory = false,
  isAnonymized = false,
}: {
  user: UserSummary
  /**
   * Server-side flag: ¿el cliente tiene pedidos históricos? Decide qué
   * acción real ejecutará el servidor, así que la UI muestra el texto
   * correcto ANTES de confirmar (evita expectativas incorrectas del
   * admin: "eliminar" nunca borra una cuenta con historial).
   */
  hasHistory?: boolean
  /** Server-side flag: cuenta ya anonimizada — la PII fue limpiada y el
   * login baneado; solo queda inspección de solo lectura. */
  isAnonymized?: boolean
}) {
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
        {!isAnonymized && (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setConfirmOpen(true)}
            title={hasHistory ? 'Desactivar y anonimizar' : 'Eliminar'}
          >
            {hasHistory ? (
              <UserXIcon className="h-4 w-4 text-destructive" />
            ) : (
              <TrashIcon className="h-4 w-4 text-destructive" />
            )}
          </Button>
        )}
      </div>

      {hasHistory ? (
        <ConfirmDialog
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          title="Desactivar y anonimizar cliente"
          description="Este cliente tiene pedidos históricos: su cuenta NO se elimina. Se anonimizarán sus datos personales, perderá el acceso y su historial se conservará como evidencia. Esta acción no se puede deshacer."
          confirmLabel="Desactivar y anonimizar"
          variant="destructive"
          onConfirm={async () => {
            const result = await deleteUser(user.id)
            return {
              ...result,
              message: result.message ?? 'Cliente desactivado y anonimizado',
            }
          }}
        />
      ) : (
        <ConfirmDialog
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          title="Eliminar cliente"
          description="¿Eliminar esta cuenta? El cliente no tiene pedidos registrados, así que la cuenta se elimina por completo. Esta acción no se puede deshacer."
          confirmLabel="Eliminar"
          variant="destructive"
          onConfirm={async () => {
            const result = await deleteUser(user.id)
            return { ...result, message: result.message ?? 'Cliente eliminado' }
          }}
        />
      )}

      <ViewUserDialog open={viewOpen} onOpenChange={setViewOpen} user={user} />
    </>
  )
}
