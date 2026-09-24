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

type RangeError = 'empty-from' | 'empty-to' | 'inverted' | 'too-long' | null

const DAY_MS = 86_400_000
const MAX_RANGE_DAYS = 366

const WEEKDAYS_FULL = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo']

const MONTHS_FULL = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

const RANGE_ERROR_TEXT: Record<Exclude<RangeError, null>, string> = {
  'empty-from': 'Selecciona la fecha «desde».',
  'empty-to': 'Selecciona la fecha «hasta».',
  inverted: 'La fecha «desde» debe ser anterior o igual a la «hasta».',
  'too-long': 'El rango no puede superar 366 días.',
}

function limaDayKey(date: Date): string {
  return date.toLocaleDateString('sv-SE', { timeZone: 'America/Lima' })
}

function dayParts(key: string): { month: number; day: number; weekday: number } {
  const [year, month, day] = key.split('-').map(Number)
  const weekday = (new Date(Date.UTC(year, month - 1, day, 17)).getUTCDay() + 6) % 7
  return { month, day, weekday }
}

function addDays(key: string, days: number): string {
  return limaDayKey(new Date(new Date(`${key}T12:00:00-05:00`).getTime() + days * DAY_MS))
}

function formatFullDate(key: string): string {
  const [year, month, day] = key.split('-')
  return `${day}/${month}/${year}`
}

const salesConfig = {
  count: { label: 'Pedidos', color: 'var(--color-primary)' },
} satisfies ChartConfig

const deliveriesConfig = {
  count: { label: 'Entregados', color: 'var(--color-green-500)' },
} satisfies ChartConfig

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
}: AdminDashboardChartsProps) {
  const todayKey = useMemo(() => limaDayKey(new Date()), [])
  const [granularity, setGranularity] = useState<Granularity>('day')
  const [dateFrom, setDateFrom] = useState(addDays(todayKey, -29))
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
    if (diffDays >= MAX_RANGE_DAYS) return 'too-long'

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
      <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
        <div>
          <Label className="mb-1.5 block text-xs font-medium">Vista</Label>
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

        <div className="space-y-1">
          <Label htmlFor="filter-from" className="text-xs font-medium">
            Desde
          </Label>
          <Input
            id="filter-from"
            type="date"
            className="w-40"
            value={dateFrom}
            max={dateTo || undefined}
            aria-invalid={fromInvalid}
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
            min={dateFrom || undefined}
            aria-invalid={toInvalid}
            onChange={(event) => setDateTo(event.target.value)}
          />
        </div>

        <div className="pb-1.5 text-xs text-muted-foreground">
          {rangeError ? (
            <p role="alert" className="text-destructive">
              {RANGE_ERROR_TEXT[rangeError]}
            </p>
          ) : (
            <p>
              Mostrando: {formatFullDate(dateFrom)} – {formatFullDate(dateTo)}
            </p>
          )}
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
                  <Bar dataKey="count" radius={[4, 4, 0, 0]} fill="var(--color-count)" />
                </BarChart>
              </ChartContainer>
            ) : (
              <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
                {salesEmptyMessage}
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
                  <Bar dataKey="count" radius={[4, 4, 0, 0]} fill="var(--color-count)" />
                </BarChart>
              </ChartContainer>
            ) : (
              <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
                {deliveriesEmptyMessage}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}