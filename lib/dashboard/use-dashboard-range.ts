'use client'

import { useMemo, useState } from 'react'
import { weekStartKey } from '@/lib/dates'
import { validateDateRange, type Granularity } from '@/lib/dashboard/chart-utils'

/**
 * Estado del rango/granularidad compartido por los dashboards de Admin,
 * Restaurante y Repartidor.
 *
 * El default vive en UN solo lugar a propósito: los tres paneles deben abrir
 * sobre la misma ventana (la semana en curso, lunes → hoy, en claves de Lima)
 * con vista "Día". Si cada panel calculara su propio default, los números
 * dejarían de ser comparables entre paneles.
 */
export function useDashboardRange(todayKey: string) {
  const [granularity, setGranularity] = useState<Granularity>('day')
  const [dateFrom, setDateFrom] = useState(() => weekStartKey(todayKey))
  const [dateTo, setDateTo] = useState(todayKey)

  const rangeError = useMemo(() => validateDateRange(dateFrom, dateTo), [dateFrom, dateTo])

  return {
    granularity,
    setGranularity,
    dateFrom,
    setDateFrom,
    dateTo,
    setDateTo,
    rangeError,
  }
}
