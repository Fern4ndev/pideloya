'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Switch } from '@/components/ui/switch'
import { toggleRestaurantActive, toggleDeliveryPersonActive } from '@/lib/actions/admin'
import { toast } from 'sonner'

export function ActiveSwitch({
  id,
  type,
  initialActive,
}: {
  id: string
  type: 'restaurant' | 'delivery'
  initialActive: boolean
}) {
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function handleToggle() {
    startTransition(async () => {
      try {
        const result = type === 'restaurant'
          ? await toggleRestaurantActive(id)
          : await toggleDeliveryPersonActive(id)

        toast.success(
          result.is_active
            ? type === 'restaurant' ? 'Restaurante activado' : 'Repartidor activado'
            : type === 'restaurant' ? 'Restaurante desactivado' : 'Repartidor desactivado'
        )
        router.refresh()
      } catch {
        toast.error('No se pudo cambiar el estado')
      }
    })
  }

  return (
    <Switch
      checked={initialActive}
      onCheckedChange={handleToggle}
      disabled={isPending}
    />
  )
}
