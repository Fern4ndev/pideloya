'use client'

import { useState, useTransition } from 'react'
import { setRestaurantActive } from '@/lib/actions/restaurants'
import { Switch } from '@/components/ui/switch'
import { StoreIcon } from 'lucide-react'
import { toast } from 'sonner'

export function BusinessStatusSwitch({
  initialIsActive,
}: {
  initialIsActive: boolean
}) {
  const [isActive, setIsActive] = useState(initialIsActive)
  const [isPending, startTransition] = useTransition()

  function handleToggle(checked: boolean) {
    setIsActive(checked)
    startTransition(async () => {
      try {
        await setRestaurantActive(checked)
        toast.success(checked ? 'Negocio abierto' : 'Negocio cerrado')
      } catch (err) {
        setIsActive(!checked)
        toast.error(err instanceof Error ? err.message : 'No se pudo cambiar el estado')
      }
    })
  }

  return (
    <div className="flex items-center gap-2 rounded-full border bg-background px-3 py-2 shadow-sm">
      <StoreIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
      <span className="text-sm font-medium">
        {isActive ? 'Abierto' : 'Cerrado'}
      </span>
      <Switch
        checked={isActive}
        onCheckedChange={handleToggle}
        disabled={isPending}
        aria-label="Negocio abierto"
      />
    </div>
  )
}