'use client'

import dynamic from 'next/dynamic'
import type { ComponentProps } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import type { DeliveryDashboardCharts } from './DeliveryDashboardCharts'

/**
 * Carga `DeliveryDashboardCharts` (recharts fuera del chunk inicial,
 * Fase 4) con `ssr: false` + skeleton. Wrapper cliente porque `ssr: false`
 * no está permitido en Server Components.
 */
const DeliveryDashboardChartsDynamic = dynamic(
  () =>
    import('./DeliveryDashboardCharts').then(
      (m) => m.DeliveryDashboardCharts
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

export function DeliveryDashboardChartsLazy(
  props: ComponentProps<typeof DeliveryDashboardCharts>
) {
  return <DeliveryDashboardChartsDynamic {...props} />
}
