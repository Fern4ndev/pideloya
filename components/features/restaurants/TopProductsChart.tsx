'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { Bar, BarChart, XAxis, YAxis } from 'recharts'

type TopProduct = { name: string; quantity: number }

const chartConfig = {
  quantity: { label: 'Unidades vendidas', color: 'var(--color-primary)' },
} satisfies ChartConfig

function truncateName(name: string) {
  return name.length > 20 ? `${name.slice(0, 18)}…` : name
}

export function TopProductsChart({ data }: { data: TopProduct[] }) {
  const hasData = data.some((d) => d.quantity > 0)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Productos más vendidos (30 días)</CardTitle>
      </CardHeader>
      <CardContent>
        {hasData ? (
          <ChartContainer config={chartConfig} className="h-[300px] w-full">
            <BarChart data={data} layout="vertical" accessibilityLayer>
              <XAxis type="number" tickLine={false} axisLine={false} tickMargin={8} allowDecimals={false} />
              <YAxis
                type="category"
                dataKey="name"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                width={140}
                tickFormatter={truncateName}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={(value) => [`${value} unidades`, 'Vendidos']}
                    labelFormatter={(label, payload) =>
                      String(payload?.[0]?.payload?.name ?? label)
                    }
                  />
                }
              />
              <Bar
                dataKey="quantity"
                radius={[0, 4, 4, 0]}
                fill="var(--color-primary)"
              />
            </BarChart>
          </ChartContainer>
        ) : (
          <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
            Sin productos vendidos en los últimos 30 días.
          </div>
        )}
      </CardContent>
    </Card>
  )
}
