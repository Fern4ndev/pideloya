'use client'

import { ClockIcon } from 'lucide-react'
import { useRestaurantOpen } from '@/lib/hooks/use-restaurant-open'
import type { RestaurantHourInput } from '@/lib/restaurants/is-open'

export function RestaurantOpenBanner({
  isOpen,
  hours,
}: {
  isOpen: boolean
  hours: RestaurantHourInput[]
}) {
  const isOpenNow = useRestaurantOpen(isOpen, hours)

  if (isOpenNow) return null

  return (
    <div className="flex items-center gap-2 rounded-xl border border-amber-300/60 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
      <ClockIcon className="h-4 w-4 shrink-0" />
      <span>
        Cerrado &mdash; no hay atención en este momento, no se pueden registrar
        pedidos.
      </span>
    </div>
  )
}