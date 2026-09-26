'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { PackageOpenIcon } from 'lucide-react'
import { Bar, BarChart, XAxis, YAxis } from 'recharts'

type TopProduct = { name: string; quantity: number }

const chartConfig = {
  quantity: { label: 'Unidades vendidas', color: 'var(--color-violet)' },
} satisfies ChartConfig

function truncateName(name: string) {
  return name.length > 20 ? `${name.slice(0, 18)}…` : name
}

/**
 * "Productos más vendidos" dentro del rango elegido. Usa violeta — el mismo
 * color que Admin reserva para su gráfico secundario — para diferenciarlo del
 * gráfico de ventas (lime igual que Admin/Restaurante).
 */
export function TopProductsChart({
  data,
  emptyMessage,
}: {
  data: TopProduct[]
  emptyMessage: string
}) {
  const hasData = data.some((product) => product.quantity > 0)

  return (
    <Card>
      <CardHeader>
        {/* Punto de color + texto: mismo patrón de título que Admin */}
        <CardTitle className="flex items-center gap-2 text-base">
          <span className="h-2 w-2 rounded-full bg-violet" aria-hidden />
          Productos más vendidos
        </CardTitle>
      </CardHeader>
      <CardContent>
        {hasData ? (
          <ChartContainer config={chartConfig} className="h-[300px] w-full">
            <BarChart data={data} layout="vertical" accessibilityLayer>
              <defs>
                <linearGradient id="restaurantTopProductsGradient" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="var(--color-quantity)" stopOpacity={0.55} />
                  <stop offset="100%" stopColor="var(--color-quantity)" stopOpacity={1} />
                </linearGradient>
              </defs>
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
                radius={[0, 6, 6, 0]}
                fill="url(#restaurantTopProductsGradient)"
              />
            </BarChart>
          </ChartContainer>
        ) : (
          <div className="flex h-[300px] flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
            <PackageOpenIcon className="h-8 w-8 text-muted-foreground/40" aria-hidden />
            <p className="max-w-52">{emptyMessage}</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
