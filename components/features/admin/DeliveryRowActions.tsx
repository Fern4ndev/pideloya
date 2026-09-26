'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { UserXIcon } from 'lucide-react'
import {
  approveDeliveryPerson,
  deactivateUser,
} from '@/lib/actions/admin'
import { RowActions } from './RowActions'
import { EditDeliveryDialog } from './EditDeliveryDialog'

type DeliveryPerson = {
  id: string
  full_name: string
  phone: string | null
  document_type: string | null
  document_number: string | null
  vehicle_type: string | null
}

export function DeliveryRowActions({
  id,
  isActive,
  hasDeliveries = false,
  deliveryPerson,
}: {
  id: string
  isActive: boolean
  /** Server-side flag: tiene entregas históricas (decide el texto del botón de borrado). */
  hasDeliveries?: boolean
  deliveryPerson: DeliveryPerson
}) {
  const [editOpen, setEditOpen] = useState(false)
  const router = useRouter()

  return (
    <>
      <RowActions
        onApprove={
          !isActive
            ? async () => {
                const result = await approveDeliveryPerson(id)
                return { ...result, message: 'Repartidor activado' }
              }
            : undefined
        }
        onEdit={() => setEditOpen(true)}
        onDelete={
          isActive
            ? async () => {
                const result = await deactivateUser(id)
                return { ...result, message: 'Repartidor desactivado' }
              }
            : undefined
        }
        entityName="repartidor"
        approveLabel="Reactivar"
        deleteTitle="Desactivar repartidor"
        deleteDescription={
          hasDeliveries
            ? '¿Desactivar este repartidor? Tiene entregas históricas: si en el futuro lo eliminas, sus datos se anonimizarán en vez de borrarse (su historial se conserva como evidencia). Podrás reactivarlo cuando quieras.'
            : '¿Desactivar este repartidor? Podrás reactivarlo cuando quieras. Su historial de entregas se conserva.'
        }
        deleteConfirmLabel="Desactivar"
        deleteIcon={<UserXIcon className="h-4 w-4 text-destructive" />}
      />
      <EditDeliveryDialog
        open={editOpen}
        onOpenChange={(open) => {
          setEditOpen(open)
          if (!open) router.refresh()
        }}
        deliveryPerson={deliveryPerson}
      />
    </>
  )
}
