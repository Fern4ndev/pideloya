'use client'

import dynamic from 'next/dynamic'
import type { ComponentProps } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import type { RestaurantDashboardCharts } from './RestaurantDashboardCharts'

/**
 * Carga `RestaurantDashboardCharts` (recharts fuera del chunk inicial,
 * Fase 4) con `ssr: false` + skeleton. Wrapper cliente porque `ssr: false`
 * no está permitido en Server Components.
 */
const RestaurantDashboardChartsDynamic = dynamic(
  () =>
    import('./RestaurantDashboardCharts').then(
      (m) => m.RestaurantDashboardCharts
    ),
  {
    ssr: false,
    loading: () => (
      <div className="space-y-4">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-72 w-full" />
      </div>
    ),
  }
)

export function RestaurantDashboardChartsLazy(
  props: ComponentProps<typeof RestaurantDashboardCharts>
) {
  return <RestaurantDashboardChartsDynamic {...props} />
}
