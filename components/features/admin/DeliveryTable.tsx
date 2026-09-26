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
import { DeliveryRowActions } from './DeliveryRowActions'

export type DeliveryRow = {
  id: string
  full_name: string
  phone: string | null
  document_type: string | null
  document_number: string | null
  vehicle_type: string | null
  is_active: boolean
  created_at: string
  /** Server-side flag: la cuenta fue anonimizada (badge + acciones reducidas). */
  anonymizedAt: string | null
  /** Formateada en el servidor (Server Component) para evitar hydration mismatch. */
  registered: string
}

const STATUS_OPTIONS = [
  { value: '', label: 'Todos los repartidores' },
  { value: 'active', label: 'Activos' },
  { value: 'pending', label: 'Pendientes de aprobar' },
  { value: 'on_route', label: 'En ruta ahora mismo' },
]

/** Espejo de SORTABLE_DELIVERIES de la página (whitelist compartida a
 * propósito: la página valida, esta tabla solo construye hrefs). */
const SORTABLE = [
  { key: 'full_name', label: 'Nombre' },
  { key: 'document_number', label: 'DNI' },
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
  return `/admin/repartidores?${params.toString()}`
}

export function DeliveryTable({
  deliveries,
  initialQuery,
  startIndex,
  currentStatus = '',
  currentSort = '',
  currentDir = 'desc',
  hasDeliveriesMap,
  pagination,
}: {
  deliveries: DeliveryRow[]
  initialQuery: string
  startIndex: number
  currentStatus?: string
  currentSort?: string
  currentDir?: 'asc' | 'desc'
  /** Server-side flag: tiene entregas históricas (decide la acción de borrado). */
  hasDeliveriesMap: Record<string, boolean>
  pagination: AdminTableShellPagination
}) {
  // Selección para aprobación EN LOTE (Fase 8). Solo filas inactivas son
  // seleccionables (aprobar ya-activo no cambia nada) y nunca cuentas
  // anonimizadas (reactivarlas sería un error operativo: la cuenta está
  // de baja permanentemente).
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const selectableIds = useMemo(
    () =>
      deliveries
        .filter((d) => !d.is_active && !d.anonymizedAt)
        .map((d) => d.id),
    [deliveries]
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
      searchPlaceholder="Buscar por nombre, DNI o teléfono..."
      statusOptions={STATUS_OPTIONS}
      exportEntity="deliveries"
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
                  aria-label="Seleccionar todos los repartidores pendientes de la página"
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
                  className={
                    col.key === 'full_name' ? 'w-48' : col.key === 'document_number' ? 'w-24' : 'w-28 text-center'
                  }
                />
              ))}
              <TableHead className="w-28">Vehículo</TableHead>
              <TableHead className="w-24">Teléfono</TableHead>
              <TableHead className="w-24">Estado</TableHead>
              <TableHead className="w-20">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {deliveries.map((d, index) => {
              const isSelectable = !d.is_active && !d.anonymizedAt
              const isSelected = selectedIds.has(d.id)

              return (
                <TableRow
                  key={d.id}
                  data-state={isSelected ? 'selected' : undefined}
                >
                  <TableCell>
                    {isSelectable && (
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleOne(d.id)}
                        aria-label={`Seleccionar ${d.full_name}`}
                      />
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {startIndex + index + 1}
                  </TableCell>
                  <TableCell className="max-w-48 font-medium">
                    <span className="flex items-center gap-2">
                      <span className="truncate" title={d.full_name ?? ''}>
                        {d.full_name}
                      </span>
                      {d.anonymizedAt && (
                        <Badge
                          variant="outline"
                          title={`Anonimizada el ${d.anonymizedAt}`}
                        >
                          Anonimizado
                        </Badge>
                      )}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground tabular-nums">
                    {d.document_number ?? '—'}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {d.vehicle_type ?? '—'}
                  </TableCell>
                  <TableCell className="text-muted-foreground tabular-nums">
                    {d.phone ?? '—'}
                  </TableCell>
                  <TableCell>
                    {d.is_active ? (
                      <Badge variant="secondary">Activo</Badge>
                    ) : (
                      <Badge variant="outline">Inactivo</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-center text-muted-foreground">
                    {d.registered}
                  </TableCell>
                  <TableCell>
                    <DeliveryRowActions
                      id={d.id}
                      isActive={d.is_active}
                      isAnonymized={!!d.anonymizedAt}
                      hasDeliveries={hasDeliveriesMap[d.id] ?? false}
                      deliveryPerson={{
                        id: d.id,
                        full_name: d.full_name,
                        phone: d.phone,
                        document_type: d.document_type,
                        document_number: d.document_number,
                        vehicle_type: d.vehicle_type,
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
        entity="deliveries"
        selectedIds={[...selectedIds]}
        onClear={() => setSelectedIds(new Set())}
      />
    </AdminTableShell>
  )
}
