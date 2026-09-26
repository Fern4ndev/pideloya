'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CalendarIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  GRANULARITY_OPTIONS,
  RANGE_ERROR_TEXT,
  type Granularity,
  type RangeError,
} from '@/lib/dashboard/chart-utils'

/**
 * Barra de filtros compartida por los dashboards de Admin, Restaurante y
 * Repartidor: pills de granularidad (Día / Semana / Mes) + rango de fechas con
 * su mensaje de error. Es estado 100% controlado por el componente padre, que
 * es quien filtra/agrega en memoria sobre los datos ya traídos del servidor.
 *
 * `children` existe para selects extra por panel (hoy Admin los renderiza en el
 * header de cada Card, así que no pasa ninguno); Restaurante y Repartidor no
 * necesitan ninguno. El layout es el mismo en los tres paneles.
 */
export function DashboardRangeFilterBar({
  granularity,
  onGranularityChange,
  dateFrom,
  dateTo,
  onDateFromChange,
  onDateToChange,
  rangeError,
  children,
}: {
  granularity: Granularity
  onGranularityChange: (g: Granularity) => void
  dateFrom: string
  dateTo: string
  onDateFromChange: (v: string) => void
  onDateToChange: (v: string) => void
  rangeError: RangeError
  children?: React.ReactNode
}) {
  const fromInvalid =
    rangeError === 'empty-from' || rangeError === 'inverted' || rangeError === 'too-long'
  const toInvalid =
    rangeError === 'empty-to' || rangeError === 'inverted' || rangeError === 'too-long'

  return (
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
                onClick={() => onGranularityChange(option.key)}
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
            onChange={(event) => onDateFromChange(event.target.value)}
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
            onChange={(event) => onDateToChange(event.target.value)}
          />
        </div>
      </div>

      {children}

      {rangeError && (
        <p role="alert" className="text-xs text-destructive">
          {RANGE_ERROR_TEXT[rangeError]}
        </p>
      )}
    </div>
  )
}
