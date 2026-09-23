'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { Area, AreaChart, XAxis, YAxis } from 'recharts'

type DailySales = { date: string; total: number }

const chartConfig = {
  total: { label: 'Ventas', color: 'var(--color-primary)' },
} satisfies ChartConfig

function formatDay(key: string) {
  const [, month, day] = key.split('-')
  return `${day}/${month}`
}

function formatFullDay(key: string) {
  const [year, month, day] = key.split('-')
  return `${day}/${month}/${year}`
}

export function DailySalesChart({ data }: { data: DailySales[] }) {
  const hasData = data.some((d) => d.total > 0)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Ventas por día (últimos 7 días)</CardTitle>
      </CardHeader>
      <CardContent>
        {hasData ? (
          <ChartContainer config={chartConfig} className="h-[300px] w-full">
            <AreaChart data={data} accessibilityLayer>
              <XAxis
                dataKey="date"
                tickFormatter={formatDay}
                tickLine={false}
                axisLine={false}
                tickMargin={8}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                tickFormatter={(value) => `S/ ${value}`}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={(value) => [`S/ ${Number(value).toFixed(2)}`, 'Ventas']}
                    labelFormatter={(label) => formatFullDay(String(label))}
                  />
                }
              />
              <Area
                dataKey="total"
                type="monotone"
                fill="var(--color-primary)"
                fillOpacity={0.15}
                stroke="var(--color-primary)"
                strokeWidth={2}
                dot={false}
              />
            </AreaChart>
          </ChartContainer>
        ) : (
          <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
            Aún no hay ventas en los últimos 7 días.
          </div>
        )}
      </CardContent>
    </Card>
  )
}
