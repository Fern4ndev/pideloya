'use client'

import { useMemo, useState } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { TableShell } from '@/components/ui/table-shell'
import { AdminTableShell } from './AdminTableShell'
import type { AdminTableShellPagination } from './AdminTableShell'
import { SortableTableHead } from './SortableTableHead'
import { BulkApproveBar } from './BulkApproveBar'
import { RestaurantRowActions } from './RestaurantRowActions'

export type RestaurantRow = {
  id: string
  name: string
  slug: string
  address_text: string | null
  whatsapp: string | null
  food_type: string | null
  is_approved: boolean
  is_active: boolean
  restaurant_members: {
    profiles: {
      full_name: string | null
    } | null
  }[] | null
  /** Formateada en el servidor (Server Component) para evitar hydration mismatch. */
  registered: string
}

const STATUS_OPTIONS = [
  { value: '', label: 'Todos los estados' },
  { value: 'pending', label: 'Pendientes de aprobar' },
  { value: 'active', label: 'Aprobados y activos' },
  { value: 'suspended', label: 'Desactivados' },
]

/** Espejo de SORTABLE_RESTAURANTS de la página (whitelist compartida a
 * propósito: la página valida, esta tabla solo construye hrefs). */
const SORTABLE = [
  { key: 'name', label: 'Negocio' },
  { key: 'owner', label: 'Dueño' },
  { key: 'food_type', label: 'Tipo' },
  { key: 'created_at', label: 'Registro' },
] as const

function sortHref(
  column: string,
  currentSort: string,
  currentDir: 'asc' | 'desc',
  query: string,
  status: string
): string {
  // Columna activa → alterna dir; inactiva → activa en ascendente.
  const nextDir = currentSort === column && currentDir === 'asc' ? 'desc' : 'asc'
  const params = new URLSearchParams()
  if (query) params.set('q', query)
  if (status) params.set('status', status)
  params.set('sort', column)
  params.set('dir', nextDir)
  return `/admin/restaurantes?${params.toString()}`
}

export function RestaurantTable({
  restaurants,
  initialQuery,
  startIndex,
  currentStatus = '',
  currentSort = '',
  currentDir = 'desc',
  pagination,
}: {
  restaurants: RestaurantRow[]
  initialQuery: string
  startIndex: number
  currentStatus?: string
  currentSort?: string
  currentDir?: 'asc' | 'desc'
  pagination: AdminTableShellPagination
}) {
  // Selección para aprobación EN LOTE (Fase 8). Vive en estado local a
  // propósito: es UI transitoria (se pierde al navegar, como en todo
  // panel admin), no estado compartible — lo que sí vive en querystring
  // es el universo filtrado sobre el que se selecciona.
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // Solo filas pendientes son seleccionables (aprobar ya-activo no hace
  // nada; aprobar desactivado reactiva — también vale la pena permitirlo,
  // mismo efecto que el botón individual "Reactivar").
  const selectableIds = useMemo(
    () => restaurants.map((r) => r.id),
    [restaurants]
  )

  const allSelected =
    selectableIds.length > 0 &&
    selectableIds.every((id) => selectedIds.has(id))
  const someSelected = selectableIds.some((id) => selectedIds.has(id))

  function toggleOne(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <AdminTableShell
      searchPlaceholder="Buscar por negocio, dueño o tipo..."
      statusOptions={STATUS_OPTIONS}
      exportEntity="restaurants"
      pagination={pagination}
    >
      <TableShell>
        <Table className="table-fixed">
          <TableHeader>
            <TableRow>
              <TableHead className="w-8">
                <Checkbox
                  checked={allSelected}
                  indeterminate={someSelected && !allSelected}
                  onCheckedChange={(checked) =>
                    setSelectedIds(checked ? new Set(selectableIds) : new Set())
                  }
                  aria-label="Seleccionar todos los restaurantes de la página"
                />
              </TableHead>
              <TableHead className="w-10">N°</TableHead>
              {SORTABLE.map((col) => (
                <SortableTableHead
                  key={col.key}
                  label={col.label}
                  column={col.key}
                  activeSort={currentSort}
                  activeDir={currentDir}
                  nextHref={sortHref(col.key, currentSort, currentDir, initialQuery, currentStatus)}
                  className={col.key === 'created_at' ? 'w-28 text-center' : 'w-28'}
                />
              ))}
              <TableHead className="w-28">WhatsApp</TableHead>
              <TableHead className="w-24">Estado</TableHead>
              <TableHead className="w-28">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {restaurants.map((r, index) => {
              const ownerName =
                r.restaurant_members?.[0]?.profiles?.full_name ?? '—'
              const isSelected = selectedIds.has(r.id)

              return (
                <TableRow
                  key={r.id}
                  data-state={isSelected ? 'selected' : undefined}
                >
                  <TableCell>
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggleOne(r.id)}
                      aria-label={`Seleccionar ${r.name}`}
                    />
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {startIndex + index + 1}
                  </TableCell>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell>{ownerName}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {r.food_type ?? '—'}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {r.whatsapp ?? '—'}
                  </TableCell>
                  <TableCell>
                    {r.is_approved && r.is_active ? (
                      <Badge>Aprobado</Badge>
                    ) : r.is_approved && !r.is_active ? (
                      <Badge variant="secondary">Desactivado</Badge>
                    ) : (
                      <Badge variant="outline">Pendiente</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-center text-muted-foreground">
                    {r.registered}
                  </TableCell>
                  <TableCell>
                    <RestaurantRowActions
                      id={r.id}
                      isApproved={r.is_approved}
                      isActive={r.is_active}
                      restaurant={{
                        id: r.id,
                        name: r.name,
                        food_type: r.food_type,
                        whatsapp: r.whatsapp,
                        address_text: r.address_text,
                      }}
                    />
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </TableShell>

      <BulkApproveBar
        entity="restaurants"
        selectedIds={[...selectedIds]}
        onClear={() => setSelectedIds(new Set())}
      />
    </AdminTableShell>
  )
}
