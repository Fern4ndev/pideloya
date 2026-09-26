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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { BarChart3Icon, CalendarIcon, TruckIcon } from 'lucide-react'
import {
  DAY_MS,
  RANGE_MAX_DAYS,
  WEEKDAYS_FULL,
  MONTHS_FULL,
  addDays,
  dayParts,
  formatFullDate,
  limaDayKey,
} from '@/lib/dates'

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
  todayKey: string
}

type RangeError = 'empty-from' | 'empty-to' | 'inverted' | 'too-long' | null

const RANGE_ERROR_TEXT: Record<Exclude<RangeError, null>, string> = {
  'empty-from': 'Selecciona la fecha «desde».',
  'empty-to': 'Selecciona la fecha «hasta».',
  inverted: 'La fecha «desde» debe ser anterior o igual a la «hasta».',
  'too-long': 'El rango no puede superar 366 días.',
}

const salesConfig = {
  count: { label: 'Pedidos', color: 'var(--color-lime)' },
} satisfies ChartConfig

const deliveriesConfig = {
  count: { label: 'Entregados', color: 'var(--color-violet)' },
} satisfies ChartConfig

const GRANULARITY_OPTIONS = [
  { key: 'day' as const, label: 'Día' },
  { key: 'week' as const, label: 'Semana' },
  { key: 'month' as const, label: 'Mes' },
]

type Bucket = { key: string; label: string; count: number; total: number }

const FIXED_BUCKETS: Record<Granularity, { key: string; label: string }[]> = {
  day: WEEKDAYS_FULL.map((label, index) => ({ key: String(index), label })),
  week: Array.from({ length: 5 }, (_, index) => ({ key: String(index + 1), label: `Sem ${index + 1}` })),
  month: MONTHS_FULL.map((label, index) => ({ key: String(index), label })),
}

function bucketKeyFor(createdAt: string, granularity: Granularity): string {
  const { month, day, weekday } = dayParts(limaDayKey(new Date(createdAt)))
  if (granularity === 'day') return String(weekday)
  if (granularity === 'week') return String(Math.floor((day - 1) / 7) + 1)
  return String(month - 1)
}

function buildBuckets(
  granularity: Granularity,
  counts: Map<string, { count: number; total: number }>
): Bucket[] {
  return FIXED_BUCKETS[granularity].map(({ key, label }) => {
    const current = counts.get(key) ?? { count: 0, total: 0 }
    return { key, label, count: current.count, total: current.total }
  })
}

function aggregate(orders: AdminChartOrder[], granularity: Granularity): Bucket[] {
  const counts = new Map<string, { count: number; total: number }>()
  for (const order of orders) {
    const key = bucketKeyFor(order.created_at, granularity)
    const current = counts.get(key) ?? { count: 0, total: 0 }
    current.count += 1
    current.total += Number(order.total)
    counts.set(key, current)
  }
  return buildBuckets(granularity, counts)
}

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

  const rangeError = useMemo<RangeError>(() => {
    if (!dateFrom) return 'empty-from'
    if (!dateTo) return 'empty-to'
    if (dateFrom > dateTo) return 'inverted'

    const diffDays = Math.round(
      (new Date(`${dateTo}T12:00:00-05:00`).getTime() - new Date(`${dateFrom}T12:00:00-05:00`).getTime()) /
        DAY_MS
    )
    if (diffDays >= RANGE_MAX_DAYS) return 'too-long'

    return null
  }, [dateFrom, dateTo])

  const fromInvalid = rangeError === 'empty-from' || rangeError === 'inverted' || rangeError === 'too-long'
  const toInvalid = rangeError === 'empty-to' || rangeError === 'inverted' || rangeError === 'too-long'

  const spanOrders = useMemo(() => {
    if (rangeError) return []

    const fromTs = new Date(`${dateFrom}T00:00:00-05:00`).getTime()
    const toTs = new Date(`${dateTo}T23:59:59-05:00`).getTime()

    return orders.filter((order) => {
      const ts = new Date(order.created_at).getTime()
      return ts >= fromTs && ts <= toTs
    })
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

    return aggregate(relevant, granularity)
  }, [spanOrders, orderItems, restaurantId, granularity, rangeError])

  const delivered = useMemo(() => {
    if (rangeError) return []

    const personByOrder = new Map(deliveries.map((d) => [d.order_id, d.delivery_person_id]))

    const relevant = spanOrders.filter((order) => {
      if (order.status !== 'DELIVERED') return false
      const personId = personByOrder.get(order.id)
      return personId !== undefined && (deliveryPersonId === 'all' || personId === deliveryPersonId)
    })

    return aggregate(relevant, granularity)
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
      <div className="flex flex-wrap items-end gap-x-6 gap-y-3 rounded-2xl border bg-muted/30 p-4">
        <div>
          <Label className="mb-1.5 block text-xs font-medium">Vista</Label>
          <div className="inline-flex items-center gap-1 rounded-full bg-muted p-1">
            {GRANULARITY_OPTIONS.map((option) => {
              const active = granularity === option.key
              return (
                <button
                  key={option.key}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setGranularity(option.key)}
                  className={cn(
                    'rounded-full px-3 py-1 text-sm font-medium transition-colors',
                    active
                      ? 'bg-lime text-[#0C0C0E] shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {option.label}
                </button>
              )
            })}
          </div>
        </div>

        <div className="space-y-1">
          <Label htmlFor="filter-from" className="text-xs font-medium">
            Desde
          </Label>
          <div className="relative">
            <CalendarIcon className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="filter-from"
              type="date"
              className="w-40 pl-8"
              value={dateFrom}
              max={dateTo || undefined}
              aria-invalid={fromInvalid}
              onChange={(event) => setDateFrom(event.target.value)}
            />
          </div>
        </div>

        <div className="space-y-1">
          <Label htmlFor="filter-to" className="text-xs font-medium">
            Hasta
          </Label>
          <div className="relative">
            <CalendarIcon className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="filter-to"
              type="date"
              className="w-40 pl-8"
              value={dateTo}
              min={dateFrom || undefined}
              aria-invalid={toInvalid}
              onChange={(event) => setDateTo(event.target.value)}
            />
          </div>
        </div>

        {rangeError && (
          <p role="alert" className="text-xs text-destructive">
            {RANGE_ERROR_TEXT[rangeError]}
          </p>
        )}
      </div>

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