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
  name,
  isApproved,
  restaurant,
}: {
  id: string
  name: string
  isApproved: boolean
  restaurant: Restaurant
}) {
  const [editOpen, setEditOpen] = useState(false)
  const router = useRouter()

  return (
    <>
      <RowActions
        isApproved={isApproved}
        onApprove={() => approveRestaurant(id)}
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
