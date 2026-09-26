/**
 * Utilidades compartidas de los dashboards (Admin / Restaurante / Repartidor).
 *
 * Vive fuera de los componentes porque la agregación en "buckets" y la
 * validación de rangos de fecha son justamente la lógica frágil (zona horaria
 * de Lima, límites de rango) que no conviene triplicar en cada panel: si las
 * tres copias divergen, los tres dashboards muestran números distintos para
 * los mismos datos.
 *
 * Es un módulo puro: sin JSX, sin estado de React, sin fetch.
 */

import {
  DAY_MS,
  RANGE_MAX_DAYS,
  WEEKDAYS_FULL,
  MONTHS_FULL,
  dayParts,
  limaDayKey,
} from '@/lib/dates'

/** Granularidad del eje X del gráfico: por día de la semana, por semana o por mes. */
export type Granularity = 'day' | 'week' | 'month'

export type RangeError = 'empty-from' | 'empty-to' | 'inverted' | 'too-long' | null

export const RANGE_ERROR_TEXT: Record<Exclude<RangeError, null>, string> = {
  'empty-from': 'Selecciona la fecha «desde».',
  'empty-to': 'Selecciona la fecha «hasta».',
  inverted: 'La fecha «desde» debe ser anterior o igual a la «hasta».',
  'too-long': 'El rango no puede superar 366 días.',
}

export const GRANULARITY_OPTIONS = [
  { key: 'day' as const, label: 'Día' },
  { key: 'week' as const, label: 'Semana' },
  { key: 'month' as const, label: 'Mes' },
]

export type Bucket = { key: string; label: string; count: number; total: number }

const FIXED_BUCKETS: Record<Granularity, { key: string; label: string }[]> = {
  day: WEEKDAYS_FULL.map((label, index) => ({ key: String(index), label })),
  week: Array.from({ length: 5 }, (_, index) => ({
    key: String(index + 1),
    label: `Sem ${index + 1}`,
  })),
  month: MONTHS_FULL.map((label, index) => ({ key: String(index), label })),
}

/** Bucket (posición en el eje X) al que pertenece una fecha, en horas de Lima. */
export function bucketKeyFor(createdAt: string, granularity: Granularity): string {
  const { month, day, weekday } = dayParts(limaDayKey(new Date(createdAt)))
  if (granularity === 'day') return String(weekday)
  if (granularity === 'week') return String(Math.floor((day - 1) / 7) + 1)
  return String(month - 1)
}

/** Rellena los buckets fijos de la granularidad con los conteos acumulados. */
export function buildBuckets(
  granularity: Granularity,
  counts: Map<string, { count: number; total: number }>
): Bucket[] {
  return FIXED_BUCKETS[granularity].map(({ key, label }) => {
    const current = counts.get(key) ?? { count: 0, total: 0 }
    return { key, label, count: current.count, total: current.total }
  })
}

/**
 * Agrupa filas con `created_at` + `total` en buckets de la granularidad pedida.
 * Genérico sobre el tipo de fila para poder reusarlo con subsets de columnas
 * (ej. `order_items` con `unit_price * quantity` ya sumado en `total`).
 */
export function aggregateOrders<T extends { created_at: string; total: number }>(
  orders: T[],
  granularity: Granularity
): Bucket[] {
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

/**
 * Valida un rango de fechas `YYYY-MM-DD` (claves de día en Lima).
 * El límite duro es `RANGE_MAX_DAYS` para que el cliente nunca tenga que
 * renderizar más de un año de datos de una sola vez.
 */
export function validateDateRange(dateFrom: string, dateTo: string): RangeError {
  if (!dateFrom) return 'empty-from'
  if (!dateTo) return 'empty-to'
  if (dateFrom > dateTo) return 'inverted'

  const diffDays = Math.round(
    (new Date(`${dateTo}T12:00:00-05:00`).getTime() -
      new Date(`${dateFrom}T12:00:00-05:00`).getTime()) /
      DAY_MS
  )
  if (diffDays >= RANGE_MAX_DAYS) return 'too-long'

  return null
}

/**
 * Filtra filas a las que caen dentro del rango `[dateFrom, dateTo]` inclusive,
 * interpretado en horas de Lima (igual que `validateDateRange`), para que el
 * día "hasta" incluya todo su contenido y no solo hasta medianoche UTC.
 * Los límites se calculan una sola vez (no por fila).
 */
export function filterByRange<T extends { created_at: string }>(
  rows: T[],
  dateFrom: string,
  dateTo: string
): T[] {
  const fromTs = new Date(`${dateFrom}T00:00:00-05:00`).getTime()
  const toTs = new Date(`${dateTo}T23:59:59-05:00`).getTime()

  return rows.filter((row) => {
    const ts = new Date(row.created_at).getTime()
    return ts >= fromTs && ts <= toTs
  })
}
