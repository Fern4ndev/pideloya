'use client'

import { useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { Bar, BarChart, XAxis, YAxis } from 'recharts'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { BarChart3Icon, TruckIcon } from 'lucide-react'
import {
  aggregateDailyCounts,
  filterDailyByRange,
} from '@/lib/dashboard/chart-utils'
import { useDashboardRange } from '@/lib/dashboard/use-dashboard-range'
import { DashboardRangeFilterBar } from '@/components/features/dashboard/DashboardRangeFilterBar'

/**
 * Payload pre-agregado de admin_dashboard(p_days) (migración 20261003120600):
 * la agregación por día de Lima corre en la base, el cliente re-bucketea
 * día→semana/mes en memoria (cambiar rango/granularidad no dispara
 * consultas, igual que antes) y ya no depende de traer TODAS las filas de
 * orders/order_items/deliveries — el límite PostgREST max_rows truncaba
 * silenciosamente a 1000 y las gráficas mentían al crecer.
 */
export type AdminDashboardData = {
  restaurants: { id: string; name: string }[]
  delivery_persons: { id: string; full_name: string }[]
  sales_daily: { day: string; n: number }[]
  sales_by_restaurant: { day: string; restaurant_id: string; n: number }[]
  delivered_by_person: { day: string; delivery_person_id: string; n: number }[]
}

type AdminDashboardChartsProps = {
  data: AdminDashboardData
  todayKey: string
}

const salesConfig = {
  count: { label: 'Pedidos', color: 'var(--color-lime)' },
} satisfies ChartConfig

const deliveriesConfig = {
  count: { label: 'Entregados', color: 'var(--color-violet)' },
} satisfies ChartConfig

export function AdminDashboardCharts({
  data,
  todayKey,
}: AdminDashboardChartsProps) {
  const { granularity, setGranularity, dateFrom, setDateFrom, dateTo, setDateTo, rangeError } =
    useDashboardRange(todayKey)
  const [restaurantId, setRestaurantId] = useState('all')
  const [deliveryPersonId, setDeliveryPersonId] = useState('all')

  const restaurants = data.restaurants
  const deliveryPersons = data.delivery_persons

  const sales = useMemo(() => {
    if (rangeError) return []

    // Filtro "Todos": las ventas ya vienen pre-agregadas por día;
    // con un restaurante elegido, la serie por restaurante (misma base).
    const relevant =
      restaurantId === 'all'
        ? data.sales_daily
        : data.sales_by_restaurant.filter((row) => row.restaurant_id === restaurantId)

    return aggregateDailyCounts(filterDailyByRange(relevant, dateFrom, dateTo), granularity)
  }, [data.sales_daily, data.sales_by_restaurant, restaurantId, dateFrom, dateTo, granularity, rangeError])

  const delivered = useMemo(() => {
    if (rangeError) return []

    // La RPC solo cuenta entregas de pedidos DELIVERED (ver admin_dashboard),
    // así que acá solo falta el filtro del repartidor.
    const relevant =
      deliveryPersonId === 'all'
        ? data.delivered_by_person
        : data.delivered_by_person.filter((row) => row.delivery_person_id === deliveryPersonId)

    return aggregateDailyCounts(filterDailyByRange(relevant, dateFrom, dateTo), granularity)
  }, [data.delivered_by_person, deliveryPersonId, dateFrom, dateTo, granularity, rangeError])

  const hasSales = sales.some((bucket) => bucket.count > 0)
  const hasDeliveries = delivered.some((bucket) => bucket.count > 0)

  const salesEmptyMessage = rangeError
    ? 'Corrige el rango de fechas para ver los gráficos.'
    : 'No hay pedidos en el período seleccionado.'
  const deliveriesEmptyMessage = rangeError
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
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <span className="h-2 w-2 rounded-full bg-lime" aria-hidden />
              Ventas
            </CardTitle>
            <Select
              value={restaurantId}
              onValueChange={(value) => setRestaurantId(value ?? 'all')}
              items={[
                { value: 'all', label: 'Todos' },
                ...restaurants.map((r) => ({ value: r.id, label: r.name })),
              ]}
            >
              <SelectTrigger className="max-w-56">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {restaurants.map((restaurant) => (
                  <SelectItem key={restaurant.id} value={restaurant.id}>
                    {restaurant.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent>
            {hasSales ? (
              <ChartContainer config={salesConfig} className="h-[300px] w-full">
                <BarChart data={sales} accessibilityLayer>
                  <defs>
                    <linearGradient id="salesBarGradient" x1="0" y1="0" x2="0" y2="1">
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
                  <Bar dataKey="count" radius={[6, 6, 0, 0]} fill="url(#salesBarGradient)" />
                </BarChart>
              </ChartContainer>
            ) : (
              <div className="flex h-[300px] flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
                <BarChart3Icon className="h-8 w-8 text-muted-foreground/40" aria-hidden />
                <p className="max-w-52">{salesEmptyMessage}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <span className="h-2 w-2 rounded-full bg-violet" aria-hidden />
              Entregas de repartidores
            </CardTitle>
            <Select
              value={deliveryPersonId}
              onValueChange={(value) => setDeliveryPersonId(value ?? 'all')}
              items={[
                { value: 'all', label: 'Todos' },
                ...deliveryPersons.map((p) => ({ value: p.id, label: p.full_name })),
              ]}
            >
              <SelectTrigger className="max-w-56">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {deliveryPersons.map((person) => (
                  <SelectItem key={person.id} value={person.id}>
                    {person.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent>
            {hasDeliveries ? (
              <ChartContainer config={deliveriesConfig} className="h-[300px] w-full">
                <BarChart data={delivered} accessibilityLayer>
                  <defs>
                    <linearGradient id="deliveriesBarGradient" x1="0" y1="0" x2="0" y2="1">
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
                  <Bar dataKey="count" radius={[6, 6, 0, 0]} fill="url(#deliveriesBarGradient)" />
                </BarChart>
              </ChartContainer>
            ) : (
              <div className="flex h-[300px] flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
                <TruckIcon className="h-8 w-8 text-muted-foreground/40" aria-hidden />
                <p className="max-w-52">{deliveriesEmptyMessage}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
