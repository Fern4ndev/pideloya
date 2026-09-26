'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export type StatusFilterOption = {
  value: string
  label: string
}

/**
 * Wrapper delgado sobre Select que escribe el estado del filtro en el
 * QUERYSTRING (compartible/bookmarkeable) en vez de en estado de React:
 * reemplaza `status` en la URL actual y resetea a la página 1 al cambiar.
 *
 * Lo reutilizan las tres tablas admin con opciones distintas y el valor
 * '' significa "Todos" (se quita el parámetro de la URL).
 */
export function StatusFilterSelect({
  options,
  value,
  param = 'status',
  ariaLabel = 'Filtrar por estado',
}: {
  options: StatusFilterOption[]
  /** Valor actual desde searchParams (server component). '' = todos. */
  value: string
  param?: string
  ariaLabel?: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  function handleValueChange(next: string | null) {
    const params = new URLSearchParams(searchParams.toString())
    // Un filtro nuevo redefine el universo de filas: la página actual
    // puede quedarse fuera de rango, así que siempre se vuelve a la 1.
    params.delete('page')
    if (!next) {
      params.delete(param)
    } else {
      params.set(param, next)
    }
    const qs = params.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname)
  }

  return (
    <Select
      value={value || options[0]?.value || ''}
      onValueChange={handleValueChange}
      items={options}
    >
      <SelectTrigger aria-label={ariaLabel} className="max-w-56">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
