'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  approveDeliveryPerson,
  deleteUser,
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
  deliveryPerson,
}: {
  id: string
  isActive: boolean
  deliveryPerson: DeliveryPerson
}) {
  const [editOpen, setEditOpen] = useState(false)
  const router = useRouter()

  return (
    <>
      <RowActions
        onApprove={!isActive ? () => approveDeliveryPerson(id) : undefined}
        onEdit={() => setEditOpen(true)}
        onDelete={() => deleteUser(id)}
        entityName="repartidor"
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
