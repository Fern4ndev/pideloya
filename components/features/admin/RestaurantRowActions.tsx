'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  approveRestaurant,
  deleteRestaurant,
} from '@/lib/actions/admin'
import { RowActions } from './RowActions'
import { EditRestaurantDialog } from './EditRestaurantDialog'

type Restaurant = {
  id: string
  name: string
  food_type: string | null
  whatsapp: string | null
  address_text: string | null
}

export function RestaurantRowActions({
  id,
  isApproved,
  isActive,
  restaurant,
}: {
  id: string
  isApproved: boolean
  isActive: boolean
  restaurant: Restaurant
}) {
  const [editOpen, setEditOpen] = useState(false)
  const router = useRouter()

  const isDeactivated = isApproved && !isActive
  const showApprove = !isApproved || isDeactivated

  return (
    <>
      <RowActions
        onApprove={
          showApprove
            ? async () => {
                const result = await approveRestaurant(id)
                return {
                  ...result,
                  message: isDeactivated
                    ? 'Restaurante reactivado'
                    : 'Restaurante aprobado',
                }
              }
            : undefined
        }
        approveLabel={isDeactivated ? 'Reactivar' : 'Aprobar'}
        onEdit={() => setEditOpen(true)}
        onDelete={() => deleteRestaurant(id)}
        entityName="restaurante"
        deleteTitle="Eliminar restaurante"
        deleteDescription="Se ocultará del público. Si tiene pedidos se conservará desactivado; si no, se eliminará permanentemente."
      />
      <EditRestaurantDialog
        open={editOpen}
        onOpenChange={(open) => {
          setEditOpen(open)
          if (!open) router.refresh()
        }}
        restaurant={restaurant}
      />
    </>
  )
}
