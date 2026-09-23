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
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

type Granularity = 'day' | 'week' | 'month'

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
}

const DAY_MS = 86_400_000

const MONTHS_SHORT = [
  'ene', 'feb', 'mar', 'abr', 'may', 'jun',
  'jul', 'ago', 'sep', 'oct', 'nov', 'dic',
]

function limaDayKey(date: Date): string {
  return date.toLocaleDateString('sv-SE', { timeZone: 'America/Lima' })
}

function addDays(key: string, days: number): string {
  return limaDayKey(new Date(new Date(`${key}T12:00:00-05:00`).getTime() + days * DAY_MS))
}

function bucketKey(dayKey: string, granularity: Granularity): string {
  if (granularity === 'day') return dayKey
  if (granularity === 'month') return dayKey.slice(0, 7)

  const [y, m, d] = dayKey.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d, 17))
  const mondayOffset = (date.getUTCDay() + 6) % 7
  date.setUTCDate(date.getUTCDate() - mondayOffset)
  return limaDayKey(date)
}

function formatDay(key: string): string {
  const [, month, day] = key.split('-')
  return `${day}/${month}`
}

function formatMonth(key: string): string {
  const [year, month] = key.split('-').map(Number)
  return `${MONTHS_SHORT[month - 1]} ${year}`
}

function bucketLabel(key: string, granularity: Granularity): string {
  if (granularity === 'day') return formatDay(key)
  if (granularity === 'month') return formatMonth(key)
  return `Sem ${formatDay(key)}`
}

const salesConfig = {
  count: { label: 'Pedidos', color: 'var(--color-primary)' },
} satisfies ChartConfig

const deliveriesConfig = {
  count: { label: 'Entregados', color: 'var(--color-green-500)' },
} satisfies ChartConfig

type Bucket = { key: string; label: string; count: number; total: number }

function buildBuckets(
  fromKey: string,
  toKey: string,
  granularity: Granularity,
  counts: Map<string, { count: number; total: number }>
): Bucket[] {
  const fromTs = new Date(`${fromKey}T00:00:00-05:00`).getTime()
  const toTs = new Date(`${toKey}T00:00:00-05:00`).getTime()

  const buckets: Bucket[] = []
  const seen = new Set<string>()

  for (let t = fromTs; t <= toTs; t += DAY_MS) {
    const key = bucketKey(limaDayKey(new Date(t)), granularity)
    if (seen.has(key)) continue
    seen.add(key)

    const current = counts.get(key) ?? { count: 0, total: 0 }
    buckets.push({
      key,
      label: bucketLabel(key, granularity),
      count: current.count,
      total: current.total,
    })
  }

  return buckets
}

export function AdminDashboardCharts({
  orders,
  orderItems,
  restaurants,
  deliveries,
  deliveryPersons,
}: AdminDashboardChartsProps) {
  const todayKey = useMemo(() => limaDayKey(new Date()), [])
  const [granularity, setGranularity] = useState<Granularity>('day')
  const [dateFrom, setDateFrom] = useState(addDays(todayKey, -29))
  const [dateTo, setDateTo] = useState(todayKey)
  const [restaurantId, setRestaurantId] = useState('all')
  const [deliveryPersonId, setDeliveryPersonId] = useState('all')

  const range = useMemo(() => {
    const from = dateFrom && dateTo && dateFrom > dateTo ? dateTo : (dateFrom ?? '')
    const to = dateFrom && dateTo && dateFrom > dateTo ? dateFrom : (dateTo ?? '')
    return { from, to }
  }, [dateFrom, dateTo])

  const filteredOrders = useMemo(() => {
    const fromTs = range.from
      ? new Date(`${range.from}T00:00:00-05:00`).getTime()
      : Number.NEGATIVE_INFINITY
    const toTs = range.to
      ? new Date(`${range.to}T23:59:59-05:00`).getTime()
      : Number.POSITIVE_INFINITY

    const restaurantOrderIds =
      restaurantId === 'all'
        ? null
        : new Set(
            orderItems
              .filter((item) => item.restaurant_id === restaurantId)
              .map((item) => item.order_id)
          )

    return orders.filter((order) => {
      const ts = new Date(order.created_at).getTime()
      return ts >= fromTs && ts <= toTs && (restaurantOrderIds === null || restaurantOrderIds.has(order.id))
    })
  }, [orders, orderItems, range.from, range.to, restaurantId])

  const bucketRange = useMemo(() => {
    let from = range.from
    let to = range.to

    if (!from) {
      const min = filteredOrders.reduce((acc, o) => Math.min(acc, new Date(o.created_at).getTime()), Number.POSITIVE_INFINITY)
      from = Number.isFinite(min) ? limaDayKey(new Date(min)) : todayKey
    }
    if (!to) {
      const max = filteredOrders.reduce((acc, o) => Math.max(acc, new Date(o.created_at).getTime()), Number.NEGATIVE_INFINITY)
      to = Number.isFinite(max) ? limaDayKey(new Date(max)) : todayKey
    }

    return { from, to }
  }, [range.from, range.to, filteredOrders, todayKey])

  const sales = useMemo(() => {
    const counts = new Map<string, { count: number; total: number }>()
    for (const order of filteredOrders) {
      const key = bucketKey(limaDayKey(new Date(order.created_at)), granularity)
      const current = counts.get(key) ?? { count: 0, total: 0 }
      current.count += 1
      current.total += Number(order.total)
      counts.set(key, current)
    }
    return buildBuckets(bucketRange.from, bucketRange.to, granularity, counts)
  }, [filteredOrders, granularity, bucketRange.from, bucketRange.to])

  const delivered = useMemo(() => {
    const personByOrder = new Map(deliveries.map((d) => [d.order_id, d.delivery_person_id]))

    const deliveredOrders = filteredOrders.filter(
      (order) => order.status === 'DELIVERED' && personByOrder.has(order.id)
    )

    const result = deliveredOrders.filter(
      (order) => deliveryPersonId === 'all' || personByOrder.get(order.id) === deliveryPersonId
    )

    const counts = new Map<string, { count: number; total: number }>()
    for (const order of result) {
      const key = bucketKey(limaDayKey(new Date(order.created_at)), granularity)
      const current = counts.get(key) ?? { count: 0, total: 0 }
      current.count += 1
      current.total += Number(order.total)
      counts.set(key, current)
    }
    return buildBuckets(bucketRange.from, bucketRange.to, granularity, counts)
  }, [filteredOrders, deliveries, deliveryPersonId, granularity, bucketRange.from, bucketRange.to])

  const hasSales = sales.some((bucket) => bucket.count > 0)
  const hasDeliveries = delivered.some((bucket) => bucket.count > 0)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
        <div>
          <Label className="mb-1.5 block text-xs font-medium">Agrupar por</Label>
          <div className="flex gap-1">
            {(['day', 'week', 'month'] as const).map((option) => (
              <Button
                key={option}
                type="button"
                size="sm"
                variant={granularity === option ? 'default' : 'outline'}
                onClick={() => setGranularity(option)}
              >
                {option === 'day' ? 'Día' : option === 'week' ? 'Semana' : 'Mes'}
              </Button>
            ))}
          </div>
        </div>

        <div className="flex items-end gap-3">
          <div className="space-y-1">
            <Label htmlFor="filter-from" className="text-xs font-medium">
              Desde
            </Label>
            <Input
              id="filter-from"
              type="date"
              className="w-40"
              value={dateFrom}
              onChange={(event) => setDateFrom(event.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="filter-to" className="text-xs font-medium">
              Hasta
            </Label>
            <Input
              id="filter-to"
              type="date"
              className="w-40"
              value={dateTo}
              onChange={(event) => setDateTo(event.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <CardTitle className="text-base">Ventas</CardTitle>
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
                  <XAxis
                    dataKey="label"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    minTickGap={12}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    allowDecimals={false}
                  />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        formatter={(value) => [`${value} pedidos`, 'Pedidos']}
                      />
                    }
                  />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]} fill="var(--color-count)" />
                </BarChart>
              </ChartContainer>
            ) : (
              <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
                No hay pedidos en el rango seleccionado.
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <CardTitle className="text-base">Entregas de repartidores</CardTitle>
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
                  <XAxis
                    dataKey="label"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    minTickGap={12}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    allowDecimals={false}
                  />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        formatter={(value) => [`${value} entregados`, 'Entregados']}
                      />
                    }
                  />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]} fill="var(--color-count)" />
                </BarChart>
              </ChartContainer>
            ) : (
              <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
                No hay entregas en el rango seleccionado.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}