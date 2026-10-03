'use client'

import dynamic from 'next/dynamic'
import type { ComponentProps } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import type { AdminDashboardCharts } from './AdminDashboardCharts'

/**
 * Carga `AdminDashboardCharts` (y con él recharts, ~100 KB+ gz) con
 * `next/dynamic` + `ssr: false` (Fase 4): el chunk de recharts no entra al
 * JS inicial del dashboard y el servidor no lo renderiza. El skeleton cubre
 * el hueco hasta que hidrata el chunk.
 *
 * Este wrapper es un Client Component porque `ssr: false` no está permitido
 * en Server Components (el server component /admin solo importa ESTE archivo).
 */
const AdminDashboardChartsDynamic = dynamic(
  () =>
    import('./AdminDashboardCharts').then((m) => m.AdminDashboardCharts),
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

export function AdminDashboardChartsLazy(
  props: ComponentProps<typeof AdminDashboardCharts>
) {
  return <AdminDashboardChartsDynamic {...props} />
}
