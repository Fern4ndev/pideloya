'use client'

import { useEffect, useRef, useState } from 'react'
import { Input } from '@/components/ui/input'
import { TablePagination } from '@/components/ui/table-pagination'
import { StatusFilterSelect, type StatusFilterOption } from './StatusFilterSelect'
import { useAdminTableParams } from './useAdminTableParams'
import { SearchIcon, DownloadIcon } from 'lucide-react'

export type AdminTableShellPagination = {
  /** Página activa, calculada por el server component. */
  page: number
  /** Total de páginas del resultado filtrado, calculado por el server. */
  pageCount: number
  /** basePath con los filtros no-página (q/status/sort/dir) ya adjuntos. */
  basePath: string
}

/**
 * Controles compartidos de las tablas admin (Fase 5). Encapsula:
 *
 *   - Búsqueda con debounce ~300ms sobre el input (escribe en ?q= sin
 *     esperar submit; enter fuerza la búsqueda inmediata).
 *   - StatusFilterSelect (?status=).
 *   - Botón "Exportar CSV" (Fase 7) que conserva TODOS los filtros
 *     activos del querystring.
 *   - TablePagination server-side (?page= preservando el resto).
 *
 * Las tablas específicas (Restaurant/Customer/Delivery) renderizan solo
 * la <table> como children: este shell maneja los controles. El estado
 * vive 100% en el querystring — cada cambio es un router.replace, así
 * que la URL siempre es compartible/bookmarkeable.
 */
export function AdminTableShell({
  searchPlaceholder,
  statusOptions,
  exportEntity,
  pagination,
  children,
}: {
  searchPlaceholder: string
  statusOptions?: StatusFilterOption[]
  /** Clave de entidad para el export CSV (restaurants|customers|deliveries|orders). */
  exportEntity: 'restaurants' | 'customers' | 'deliveries' | 'orders'
  /** Estado de paginación calculado por el server component. */
  pagination: AdminTableShellPagination
  children: React.ReactNode
}) {
  const { get, set, searchParams } = useAdminTableParams()

  const currentQuery = get('q')
  // Estado local para el input (el querystring es la fuente de verdad del
  // resultado; el input solo necesita fluidez de teclado). La ref
  // pendingSync distingue "el servidor todavía está ecoando lo que yo
  // escribí" (NO restaurar) de "la URL cambió por otra vía" (sí
  // restaurar: atrás/adelante, click en un Link de ordenamiento).
  const [search, setSearch] = useState(currentQuery)
  const pendingSyncRef = useRef(false)

  useEffect(() => {
    if (pendingSyncRef.current) {
      // El replace del debounce ya llegó: el eco coincide con lo escrito.
      pendingSyncRef.current = false
      return
    }
    // Cambio externo de la URL (popstate, Link de sort): sincroniza el
    // input con la fuente de verdad. Se hace durante el render, no en
    // setState-dentro-de-efecto (regla react-hooks/set-state-in-effect).
    setSearch((prev) => (prev === currentQuery ? prev : currentQuery))
  }, [currentQuery])

  // Debounce ~300ms: el querystring (y la tabla) se actualiza cuando el
  // usuario deja de escribir, no en cada tecla.
  useEffect(() => {
    if (search === currentQuery) return
    const timer = setTimeout(() => {
      pendingSyncRef.current = true
      set({ q: search.trim() || null })
    }, 300)
    return () => clearTimeout(timer)
  }, [search, currentQuery, set])

  function submitSearch(e: React.FormEvent) {
    e.preventDefault()
    set({ q: search.trim() || null }, { resetPage: true })
  }

  function buildExportHref(): string {
    const params = new URLSearchParams()
    // Copia TODOS los filtros activos (q, status, sort, dir, from, to...)
    // menos page: el export abarca el resultado completo filtrado. Se leen
    // de searchParams (no de window.location) porque este componente también
    // se renderiza en el servidor, donde `window` no existe.
    for (const [key, value] of searchParams) {
      if (key !== 'page' && value) params.set(key, value)
    }
    params.set('entity', exportEntity)
    return `/api/admin/export?${params.toString()}`
  }

  return (
    <div className="mt-6 space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <form onSubmit={submitSearch} className="relative max-w-sm flex-1">
          <SearchIcon className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={searchPlaceholder}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
            aria-label={searchPlaceholder}
          />
        </form>

        {statusOptions && (
          <StatusFilterSelect
            options={statusOptions}
            value={get('status')}
          />
        )}

        <a
          href={buildExportHref()}
          className="inline-flex h-8 items-center gap-1.5 rounded-2xl border border-transparent bg-input/50 px-3 text-sm transition-colors hover:bg-input"
        >
          <DownloadIcon className="h-4 w-4 text-muted-foreground" />
          Exportar CSV
        </a>
      </div>

      {children}

      <div className="mt-4 flex justify-end">
        <TablePagination
          basePath={pagination.basePath}
          page={pagination.page}
          pageCount={pagination.pageCount}
          alwaysShow={true}
        />
      </div>
    </div>
  )
}
