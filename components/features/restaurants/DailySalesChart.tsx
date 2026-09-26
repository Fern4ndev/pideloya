'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { BarChart3Icon } from 'lucide-react'
import { Bar, BarChart, XAxis, YAxis } from 'recharts'
import type { Bucket } from '@/lib/dashboard/chart-utils'

const chartConfig = {
  total: { label: 'Ventas', color: 'var(--color-lime)' },
} satisfies ChartConfig

/**
 * "Ventas" del restaurante, con el mismo lenguaje visual que el gráfico
 * equivalente de /admin (barras lime con degradado, tooltip de ChartTooltipContent).
 *
 * Diferencia intencional con Admin: aquí la barra mide S/ (`total`) y no el
 * número de ítems (`count`), porque el monto es la métrica que el dueño viene a
 * ver. El número de ítems del bucket se muestra en el tooltip, así que no se
 * pierde el dato (ver decisión documentada en el plan, fase 3).
 */
export function DailySalesChart({
  data,
  emptyMessage,
}: {
  data: Bucket[]
  emptyMessage: string
}) {
  const hasData = data.some((bucket) => bucket.total > 0)

  return (
    <Card>
      <CardHeader>
        {/* Punto de color + texto: mismo patrón de título que Admin */}
        <CardTitle className="flex items-center gap-2 text-base">
          <span className="h-2 w-2 rounded-full bg-lime" aria-hidden />
          Ventas
        </CardTitle>
      </CardHeader>
      <CardContent>
        {hasData ? (
          <ChartContainer config={chartConfig} className="h-[300px] w-full">
            <BarChart data={data} accessibilityLayer>
              <defs>
                <linearGradient id="restaurantSalesGradient" x1="0" y1="0" x2="0" y2="1">
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
                    formatter={(value) => [`S/ ${Number(value).toFixed(2)}`, 'Ventas']}
                    labelFormatter={(label, payload) => {
                      const bucket = payload?.[0]?.payload as Bucket | undefined
                      const units = bucket?.count ?? 0
                      return `${bucket?.label ?? label} · ${units} ${
                        units === 1 ? 'ítem' : 'ítems'
                      }`
                    }}
                  />
                }
              />
              <Bar dataKey="total" radius={[6, 6, 0, 0]} fill="url(#restaurantSalesGradient)" />
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
  )
}
