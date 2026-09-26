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
import { addDays } from '@/lib/dates'
import {
  aggregateOrders,
  filterByRange,
  validateDateRange,
  type Granularity,
} from '@/lib/dashboard/chart-utils'
import { DashboardRangeFilterBar } from '@/components/features/dashboard/DashboardRangeFilterBar'

type AdminChartOrder = { id: string; status: string; total: number; created_at: string }
type AdminChartOrderItem = { order_id: string; restaurant_id: string }
type AdminChartRestaurant = { id: string; name: string }
type AdminChartDelivery = { order_id: string; delivery_person_id: string | null }
type AdminChartPerson = { id: string; full_name: string }

type AdminDashboardChartsProps = {
  orders: AdminChartOrder[]
  orderItems: AdminChartOrderItem[]
  restaurants: AdminChartRestaurant[]
  deliveries: AdminChartDelivery[]
  deliveryPersons: AdminChartPerson[]
  todayKey: string
}

const salesConfig = {
  count: { label: 'Pedidos', color: 'var(--color-lime)' },
} satisfies ChartConfig

const deliveriesConfig = {
  count: { label: 'Entregados', color: 'var(--color-violet)' },
} satisfies ChartConfig

export function AdminDashboardCharts({
  orders,
  orderItems,
  restaurants,
  deliveries,
  deliveryPersons,
  todayKey,
}: AdminDashboardChartsProps) {
  const [granularity, setGranularity] = useState<Granularity>('day')
  const [dateFrom, setDateFrom] = useState(() => addDays(todayKey, -29))
  const [dateTo, setDateTo] = useState(todayKey)
  const [restaurantId, setRestaurantId] = useState('all')
  const [deliveryPersonId, setDeliveryPersonId] = useState('all')

  const rangeError = useMemo(() => validateDateRange(dateFrom, dateTo), [dateFrom, dateTo])

  const spanOrders = useMemo(() => {
    if (rangeError) return []

    return filterByRange(orders, dateFrom, dateTo)
  }, [orders, dateFrom, dateTo, rangeError])

  const sales = useMemo(() => {
    if (rangeError) return []

    const restaurantOrderIds =
      restaurantId === 'all'
        ? null
        : new Set(
            orderItems
              .filter((item) => item.restaurant_id === restaurantId)
              .map((item) => item.order_id)
          )

    const relevant =
      restaurantOrderIds === null
        ? spanOrders
        : spanOrders.filter((order) => restaurantOrderIds.has(order.id))

    return aggregateOrders(relevant, granularity)
  }, [spanOrders, orderItems, restaurantId, granularity, rangeError])

  const delivered = useMemo(() => {
    if (rangeError) return []

    const personByOrder = new Map(deliveries.map((d) => [d.order_id, d.delivery_person_id]))

    const relevant = spanOrders.filter((order) => {
      if (order.status !== 'DELIVERED') return false
      const personId = personByOrder.get(order.id)
      return personId !== undefined && (deliveryPersonId === 'all' || personId === deliveryPersonId)
    })

    return aggregateOrders(relevant, granularity)
  }, [spanOrders, deliveries, deliveryPersonId, granularity, rangeError])

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
