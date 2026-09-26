'use client'

import { useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { BarChart3Icon, TruckIcon } from 'lucide-react'
import { Bar, BarChart, XAxis, YAxis } from 'recharts'
import { DashboardRangeFilterBar } from '@/components/features/dashboard/DashboardRangeFilterBar'
import {
  aggregateOrders,
  filterByRange,
  validateDateRange,
  type Bucket,
  type Granularity,
} from '@/lib/dashboard/chart-utils'
import { addDays } from '@/lib/dates'

/** Fila de `deliveries` con el pedido embebido: unidad de trabajo de los dos gráficos. */
export type DashboardDelivery = {
  delivered_at: string | null
  orders: { status: string; total: number } | null
}

const deliveriesConfig = {
  count: { label: 'Entregados', color: 'var(--color-violet)' },
} satisfies ChartConfig

const revenueConfig = {
  total: { label: 'Ingresos', color: 'var(--color-lime)' },
} satisfies ChartConfig

/**
 * Gráficos del panel de repartidor. Sigue el mismo modelo que /admin y
 * /restaurante: el server component trae las entregas de hasta 366 días y aquí
 * se filtra/agrega en memoria con las primitivas compartidas, así que cambiar
 * el rango o la granularidad no dispara ninguna consulta.
 *
 * Los dos gráficos salen de los MISMOS buckets (`{ count, total }`):
 * "Entregas completadas" grafica `count` en violeta (el color que Admin usa
 * para entregas) e "Ingresos generados" grafica `total` en lime (el color del
 * dinero). Así ambos quedan siempre consistentes entre sí.
 */
export function DeliveryDashboardCharts({
  deliveries,
  todayKey,
}: {
  deliveries: DashboardDelivery[]
  todayKey: string
}) {
  const [granularity, setGranularity] = useState<Granularity>('day')
  const [dateFrom, setDateFrom] = useState(() => addDays(todayKey, -29))
  const [dateTo, setDateTo] = useState(todayKey)

  const rangeError = useMemo(() => validateDateRange(dateFrom, dateTo), [dateFrom, dateTo])

  // Bucket por `delivered_at` (cuándo se completó la entrega) y no por el
  // `created_at` del pedido: para el repartidor el hecho relevante es la
  // entrega. `aggregateOrders` recibe `created_at` porque es el nombre del
  // campo que agrupa, no porque sea el alta del pedido.
  const buckets = useMemo(() => {
    if (rangeError) return []

    const completed = deliveries
      .filter((delivery) => delivery.delivered_at && delivery.orders?.status === 'DELIVERED')
      .map((delivery) => ({
        created_at: delivery.delivered_at as string,
        total: Number(delivery.orders?.total ?? 0),
      }))

    return aggregateOrders(filterByRange(completed, dateFrom, dateTo), granularity)
  }, [deliveries, dateFrom, dateTo, granularity, rangeError])

  const hasDeliveries = buckets.some((bucket) => bucket.count > 0)
  const hasRevenue = buckets.some((bucket) => bucket.total > 0)

  const emptyMessage = rangeError
    ? 'Corrige el rango de fechas para ver los gráficos.'
    : 'No hay entregas en el período seleccionado.'

  return (
    <div className="space-y-4">
      <DashboardRangeFilterBar
        granularity={granularity}
        onGranularityChange={setGranularity}
        dateFrom={dateFrom}
        dateTo={dateTo}
        onDateFromChange={setDateFrom}
        onDateToChange={setDateTo}
        rangeError={rangeError}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            {/* Punto de color + texto: mismo patrón de título que Admin */}
            <CardTitle className="flex items-center gap-2 text-base">
              <span className="h-2 w-2 rounded-full bg-violet" aria-hidden />
              Entregas completadas
            </CardTitle>
          </CardHeader>
          <CardContent>
            {hasDeliveries ? (
              <ChartContainer config={deliveriesConfig} className="h-[300px] w-full">
                <BarChart data={buckets} accessibilityLayer>
                  <defs>
                    <linearGradient id="deliveryCountGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--color-count)" stopOpacity={1} />
                      <stop offset="100%" stopColor="var(--color-count)" stopOpacity={0.55} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="label"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    interval={0}
                    angle={-60}
                    textAnchor="end"
                    height={70}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    allowDecimals={false}
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]} fill="url(#deliveryCountGradient)" />
                </BarChart>
              </ChartContainer>
            ) : (
              <div className="flex h-[300px] flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
                <TruckIcon className="h-8 w-8 text-muted-foreground/40" aria-hidden />
                <p className="max-w-52">{emptyMessage}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <span className="h-2 w-2 rounded-full bg-lime" aria-hidden />
              Ingresos generados
            </CardTitle>
          </CardHeader>
          <CardContent>
            {hasRevenue ? (
              <ChartContainer config={revenueConfig} className="h-[300px] w-full">
                <BarChart data={buckets} accessibilityLayer>
                  <defs>
                    <linearGradient id="deliveryRevenueGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--color-total)" stopOpacity={1} />
                      <stop offset="100%" stopColor="var(--color-total)" stopOpacity={0.55} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="label"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    interval={0}
                    angle={-60}
                    textAnchor="end"
                    height={70}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    tickFormatter={(value) => `S/ ${Math.round(Number(value))}`}
                  />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        formatter={(value) => [`S/ ${Number(value).toFixed(2)}`, 'Ingresos']}
                        labelFormatter={(label, payload) => {
                          const bucket = payload?.[0]?.payload as Bucket | undefined
                          const count = bucket?.count ?? 0
                          return `${bucket?.label ?? label} · ${count} ${
                            count === 1 ? 'entrega' : 'entregas'
                          }`
                        }}
                      />
                    }
                  />
                  <Bar dataKey="total" radius={[6, 6, 0, 0]} fill="url(#deliveryRevenueGradient)" />
                </BarChart>
              </ChartContainer>
            ) : (
              <div className="flex h-[300px] flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
                <BarChart3Icon className="h-8 w-8 text-muted-foreground/40" aria-hidden />
                <p className="max-w-52">{emptyMessage}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
