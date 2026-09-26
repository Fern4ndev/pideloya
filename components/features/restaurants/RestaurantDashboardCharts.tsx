'use client'

import { useMemo, useState } from 'react'
import { DailySalesChart } from './DailySalesChart'
import { TopProductsChart } from './TopProductsChart'
import { DashboardRangeFilterBar } from '@/components/features/dashboard/DashboardRangeFilterBar'
import {
  aggregateOrders,
  filterByRange,
  validateDateRange,
  type Granularity,
} from '@/lib/dashboard/chart-utils'
import { addDays } from '@/lib/dates'

/** Línea de `order_items`: unidad de trabajo de los dos gráficos de este panel. */
export type DashboardOrderItem = {
  order_id: string
  product_name: string | null
  quantity: number
  unit_price: number
  created_at: string
}

/**
 * Gráficos del panel de restaurante. Recibe TODAS las líneas de pedido de hasta
 * 366 días (tope `RANGE_MAX_DAYS`) desde el server component y filtra/agrega en
 * memoria: cambiar el rango o la granularidad no dispara ninguna consulta, igual
 * que en /admin. Comparte con Admin y Repartidor la barra de filtros
 * (`DashboardRangeFilterBar`) y las primitivas de `lib/dashboard/chart-utils`.
 */
export function RestaurantDashboardCharts({
  orderItems,
  todayKey,
}: {
  orderItems: DashboardOrderItem[]
  todayKey: string
}) {
  const [granularity, setGranularity] = useState<Granularity>('day')
  const [dateFrom, setDateFrom] = useState(() => addDays(todayKey, -29))
  const [dateTo, setDateTo] = useState(todayKey)

  const rangeError = useMemo(() => validateDateRange(dateFrom, dateTo), [dateFrom, dateTo])

  const spanItems = useMemo(
    () => (rangeError ? [] : filterByRange(orderItems, dateFrom, dateTo)),
    [orderItems, dateFrom, dateTo, rangeError]
  )

  // Ventas: el monto de cada línea es unit_price (congelado al momento de la
  // compra) × quantity. Se agrega por bucket fijo (día de semana / semana del
  // mes / mes) y el número de ítems de cada bucket viaja como `count`.
  const sales = useMemo(
    () =>
      rangeError
        ? []
        : aggregateOrders(
            spanItems.map((item) => ({
              created_at: item.created_at,
              total: Number(item.unit_price) * item.quantity,
            })),
            granularity
          ),
    [spanItems, granularity, rangeError]
  )

  const topProducts = useMemo(() => {
    if (rangeError) return []

    const quantityByName = new Map<string, number>()
    for (const item of spanItems) {
      const name = item.product_name?.trim() || 'Producto'
      quantityByName.set(name, (quantityByName.get(name) ?? 0) + item.quantity)
    }

    return [...quantityByName.entries()]
      .map(([name, quantity]) => ({ name, quantity }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5)
  }, [spanItems, rangeError])

  const emptyMessage = rangeError
    ? 'Corrige el rango de fechas para ver los gráficos.'
    : 'No hay ventas en el período seleccionado.'

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
        <DailySalesChart data={sales} emptyMessage={emptyMessage} />
        <TopProductsChart data={topProducts} emptyMessage={emptyMessage} />
      </div>
    </div>
  )
}
