'use client'

import { useState, useTransition } from 'react'
import { setRestaurantOpen } from '@/lib/actions/restaurants'
import { Switch } from '@/components/ui/switch'
import { StoreIcon } from 'lucide-react'
import { useToast } from '@/components/ui/toast'

export function BusinessStatusSwitch({
  initialIsOpen,
}: {
  initialIsOpen: boolean
}) {
  const [isOpen, setIsOpen] = useState(initialIsOpen)
  const [isPending, startTransition] = useTransition()
  const { success, error } = useToast()

  function handleToggle(checked: boolean) {
    setIsOpen(checked)
    startTransition(async () => {
      try {
        await setRestaurantOpen(checked)
        success(checked ? 'Negocio abierto' : 'Negocio cerrado')
      } catch (err) {
        setIsOpen(!checked)
        error('No se pudo cambiar el estado', err instanceof Error ? err.message : undefined)
      }
    })
  }

  return (
    <div className="flex items-center gap-2 rounded-full border bg-background px-3 py-2 shadow-sm">
      <StoreIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
      <span className="text-sm font-medium">
        {isOpen ? 'Abierto' : 'Cerrado'}
      </span>
      <Switch
        checked={isOpen}
        onCheckedChange={handleToggle}
        disabled={isPending}
        aria-label="Negocio abierto"
      />
    </div>
  )
}