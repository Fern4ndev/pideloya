'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  approveRestaurant,
  deactivateRestaurant,
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
  isActive,
  restaurant,
}: {
  id: string
  name: string
  isApproved: boolean
  isActive: boolean
  restaurant: Restaurant
}) {
  const [editOpen, setEditOpen] = useState(false)
  const router = useRouter()

  return (
    <>
      <RowActions
        isActive={isActive}
        isApproved={isApproved}
        onApprove={() => approveRestaurant(id)}
        onEdit={() => setEditOpen(true)}
        onToggleActive={() => deactivateRestaurant(id)}
        onDelete={() => deleteRestaurant(id)}
        entityName="restaurante"
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
