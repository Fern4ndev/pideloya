import Link from 'next/link'
import { ChevronDownIcon, ChevronUpIcon, ChevronsUpDownIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Encabezado de columna ordenable para las tablas admin. Es un SERVER
 * component a propósito: el ordenamiento vive en el querystring
 * (?sort=&dir=), así que basta un <Link> que alterna la dirección —
 * sin estado de React ni hidratación. Compartible/bookmarkeable.
 *
 * - Columna inactiva: ícono neutro ChevronsUpDown, el click la activa en asc.
 * - Columna activa: flecha según `dir`; el click la alterna asc ↔ desc.
 *
 * `nextHref` lo calcula la página (server) con el resto de filtros
 * activos preservados; este componente solo lo renderiza.
 */
export function SortableTableHead({
  label,
  column,
  activeSort,
  activeDir,
  nextHref,
  className,
}: {
  label: string
  /** Nombre de columna en la whitelist de la página (p. ej. 'created_at'). */
  column: string
  /** Valor actual de ?sort= ('' si no hay orden activo). */
  activeSort: string
  /** Valor actual de ?dir= ('asc' | 'desc' | ''). */
  activeDir: string
  /** href ya construido (filtros + sort/dir alternados, página reseteada). */
  nextHref: string
  className?: string
}) {
  const isActive = activeSort === column
  const Icon = !isActive
    ? ChevronsUpDownIcon
    : activeDir === 'desc'
      ? ChevronDownIcon
      : ChevronUpIcon

  return (
    // aria-sort va sobre el <th> con los valores que define la spec ARIA.
    <th
      data-slot="table-head"
      aria-sort={
        isActive ? (activeDir === 'desc' ? 'descending' : 'ascending') : 'none'
      }
      className={cn(
        'h-10 px-2 text-left align-middle font-medium whitespace-nowrap',
        className
      )}
    >
      <Link
        href={nextHref}
        scroll={false}
        className="inline-flex items-center gap-1 rounded transition-colors hover:text-foreground"
      >
        <span>{label}</span>
        <Icon
          className={cn(
            'h-3.5 w-3.5 shrink-0',
            isActive ? 'text-foreground' : 'text-muted-foreground/50'
          )}
          aria-hidden
        />
        <span className="sr-only">
          {isActive
            ? `Ordenado por ${label} ${activeDir === 'desc' ? 'descendente' : 'ascendente'}`
            : `Ordenar por ${label}`}
        </span>
      </Link>
    </th>
  )
}
