'use client'

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { TableShell } from '@/components/ui/table-shell'
import { AdminTableShell } from './AdminTableShell'
import type { AdminTableShellPagination } from './AdminTableShell'
import { SortableTableHead } from './SortableTableHead'
import { UserRowActions } from './UserRowActions'
import type { UserSummary } from './ViewUserDialog'

export type CustomerRow = UserSummary & {
  registered: string
  /** Server-side flag: el cliente tiene pedidos históricos (decide la acción de borrado). */
  hasOrders: boolean
  /** Server-side flag: la cuenta fue anonimizada (badge + acciones reducidas). */
  anonymized?: boolean
  /** Fecha de anonimización ya formateada en el servidor (null si no aplica). */
  anonymizedAt?: string | null
}

const STATUS_OPTIONS = [
  { value: '', label: 'Todos los clientes' },
  { value: 'with_orders', label: 'Con pedidos' },
  { value: 'without_orders', label: 'Sin pedidos' },
  { value: 'anonymized', label: 'Anonimizados' },
]

/** Espejo de SORTABLE_CUSTOMERS de la página (whitelist compartida a
 * propósito: la página valida, esta tabla solo construye hrefs). */
const SORTABLE = [
  { key: 'full_name', label: 'Nombre' },
  { key: 'email', label: 'Email' },
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
  return `/admin/usuarios?${params.toString()}`
}

export function CustomerTable({
  customers,
  initialQuery,
  startIndex,
  currentStatus = '',
  currentSort = '',
  currentDir = 'desc',
  pagination,
}: {
  customers: CustomerRow[]
  initialQuery: string
  startIndex: number
  currentStatus?: string
  currentSort?: string
  currentDir?: 'asc' | 'desc'
  pagination: AdminTableShellPagination
}) {
  return (
    <AdminTableShell
      searchPlaceholder="Buscar por nombre o email..."
      statusOptions={STATUS_OPTIONS}
      exportEntity="customers"
      pagination={pagination}
    >
      <TableShell>
        <Table>
          <TableHeader>
            <TableRow>
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
                    col.key === 'full_name' ? 'w-40' : col.key === 'email' ? 'w-56' : 'w-28 text-center'
                  }
                />
              ))}
              <TableHead className="w-28">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {customers.map((c, index) => {
              return (
                <TableRow key={c.id}>
                  <TableCell className="text-muted-foreground">
                    {startIndex + index + 1}
                  </TableCell>
                  <TableCell className="font-medium">
                    <span className="flex items-center gap-2">
                      <span className="truncate" title={c.full_name}>
                        {c.full_name}
                      </span>
                      {c.anonymized && (
                        <Badge
                          variant="outline"
                          title={`Anonimizada el ${c.anonymizedAt ?? '—'}`}
                        >
                          Anonimizado
                        </Badge>
                      )}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {c.email ?? '—'}
                  </TableCell>
                  <TableCell className="text-center text-muted-foreground">
                    {c.registered}
                  </TableCell>
                  <TableCell>
                    <UserRowActions
                      user={c}
                      hasHistory={c.hasOrders}
                      isAnonymized={c.anonymized ?? false}
                    />
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </TableShell>
    </AdminTableShell>
  )
}
