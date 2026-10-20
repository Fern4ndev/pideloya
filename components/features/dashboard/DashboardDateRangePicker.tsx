'use client'

import * as React from 'react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { CalendarIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

/** `Date` local → `YYYY-MM-DD` (mismo formato que generaba el input nativo). */
function toIsoDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/** `YYYY-MM-DD` → `Date` local, sin desfase por timezone (igual que el input nativo). */
function fromIsoDate(value: string): Date | undefined {
  if (!value) return undefined
  const [year, month, day] = value.split('-').map(Number)
  if (!year || !month || !day) return undefined
  return new Date(year, month - 1, day)
}

function DateField({
  id,
  label,
  value,
  onChange,
  disabled,
  invalid,
}: {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
  disabled?: (date: Date) => boolean
  invalid?: boolean
}) {
  const [open, setOpen] = React.useState(false)
  const date = fromIsoDate(value)

  return (
    <div className="space-y-1">
      <Label htmlFor={id} className="text-xs font-medium">
        {label}
      </Label>
      <Popover
        open={open}
        onOpenChange={(next) => {
          setOpen(next)
        }}
      >
        <PopoverTrigger
          render={
            <Button
              id={id}
              type="button"
              variant="outline"
              aria-invalid={invalid || undefined}
              className="justify-start whitespace-nowrap font-normal"
            />
          }
        >
          <CalendarIcon data-icon="inline-start" />
          {date ? format(date, 'd MMM yyyy', { locale: es }) : `Elegir ${label.toLowerCase()}`}
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            locale={es}
            captionLayout="dropdown"
            defaultMonth={date}
            selected={date}
            onSelect={(next) => {
              if (next) {
                onChange(toIsoDate(next))
                setOpen(false)
              }
            }}
            disabled={disabled}
          />
        </PopoverContent>
      </Popover>
    </div>
  )
}

/**
 * Campos "Desde" / "Hasta" de los dashboards: popover con calendario
 * (react-day-picker) y selects de mes y año, en vez del `input[type=date]`
 * nativo del navegador. Trabaja con los mismos strings ISO `YYYY-MM-DD` que
 * usa el resto del flujo, así el API de `DashboardRangeFilterBar` (y sus tres
 * paneles) no cambia.
 *
 * Cada campo restringe su selección al rango del otro (Desde ≤ Hasta), igual
 * que hacían los atributos `min`/`max` del input nativo.
 */
export function DashboardDateRangePicker({
  id,
  dateFrom,
  dateTo,
  onDateFromChange,
  onDateToChange,
  invalid = false,
  className,
}: {
  id: string
  dateFrom: string
  dateTo: string
  onDateFromChange: (v: string) => void
  onDateToChange: (v: string) => void
  invalid?: boolean
  className?: string
}) {
  const from = fromIsoDate(dateFrom)
  const to = fromIsoDate(dateTo)

  return (
    <div className={cn('flex items-end gap-3', className)}>
      <DateField
        id={`${id}-from`}
        label="Desde"
        value={dateFrom}
        onChange={onDateFromChange}
        disabled={to ? (date) => date > to : undefined}
        invalid={invalid}
      />
      <DateField
        id={`${id}-to`}
        label="Hasta"
        value={dateTo}
        onChange={onDateToChange}
        disabled={from ? (date) => date < from : undefined}
        invalid={invalid}
      />
    </div>
  )
}
