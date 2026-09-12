'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import { Bar, BarChart, XAxis, YAxis } from 'recharts'

type OrderData = {
  status: string
  total: number
}

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pendiente',
  ASSIGNED: 'Asignado',
  PICKED_UP: 'Recogido',
  ON_THE_WAY: 'En camino',
  DELIVERED: 'Entregado',
  CANCELLED: 'Cancelado',
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'var(--color-amber-500)',
  ASSIGNED: 'var(--color-blue-500)',
  PICKED_UP: 'var(--color-purple-500)',
  ON_THE_WAY: 'var(--color-cyan-500)',
  DELIVERED: 'var(--color-green-500)',
  CANCELLED: 'var(--color-red-500)',
}

const chartConfig = {
  total: { label: 'Pedidos' },
  PENDING: { label: 'Pendiente', color: STATUS_COLORS.PENDING },
  ASSIGNED: { label: 'Asignado', color: STATUS_COLORS.ASSIGNED },
  PICKED_UP: { label: 'Recogido', color: STATUS_COLORS.PICKED_UP },
  ON_THE_WAY: { label: 'En camino', color: STATUS_COLORS.ON_THE_WAY },
  DELIVERED: { label: 'Entregado', color: STATUS_COLORS.DELIVERED },
  CANCELLED: { label: 'Cancelado', color: STATUS_COLORS.CANCELLED },
} satisfies ChartConfig

export function OrdersByStatusChartClient({ data }: { data: OrderData[] }) {
  const chartData = Object.entries(STATUS_LABELS).map(([key, label]) => ({
    status: label,
    total: data.find((d) => d.status === key)?.total ?? 0,
    fill: STATUS_COLORS[key],
  }))

  const hasData = data.some((d) => d.total > 0)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Pedidos por estado</CardTitle>
      </CardHeader>
      <CardContent>
        {hasData ? (
          <ChartContainer config={chartConfig} className="h-[300px] w-full">
            <BarChart data={chartData} accessibilityLayer>
              <YAxis
                dataKey="total"
                type="number"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
              />
              <XAxis
                dataKey="status"
                type="category"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={(value) => [`${value} pedidos`, 'Total']}
                  />
                }
              />
              <Bar
                dataKey="total"
                radius={[4, 4, 0, 0]}
                fill="var(--color-primary)"
              />
            </BarChart>
          </ChartContainer>
        ) : (
          <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
            No hay pedidos registrados aún.
          </div>
        )}
      </CardContent>
    </Card>
  )
}
