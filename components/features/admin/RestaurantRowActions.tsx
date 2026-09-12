'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  approveRestaurant,
  deleteRestaurant,
} from '@/lib/actions/admin'
import { RowActions } from './RowActions'
import { EditRestaurantDialog } from './EditRestaurantDialog'
import { ActiveSwitch } from './ActiveSwitch'

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
        isApproved={isApproved}
        onApprove={() => approveRestaurant(id)}
        onEdit={() => setEditOpen(true)}
        onDelete={() => deleteRestaurant(id)}
        entityName="restaurante"
        renderSwitch={
          <ActiveSwitch
            id={id}
            type="restaurant"
            initialActive={isActive}
          />
        }
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
