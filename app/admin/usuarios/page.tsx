import { createClient } from '@/lib/db/server'
import {
  CustomerTable,
  type CustomerRow,
} from '@/components/features/admin/CustomerTable'
import { getPagination, parsePage, PAGE_SIZE } from '@/lib/pagination'
import {
  CUSTOMER_STATUS_FILTERS,
  SORTABLE_CUSTOMERS,
  applyCustomerFilters,
  fetchCustomerIdsWithOrders,
  parseSortColumn,
  parseSortDir,
  parseStatusFilter,
} from '@/lib/admin/query-builders'
import { PageHeader } from '@/components/layout/PageHeader'
import { PageContainer } from '@/components/layout/PageContainer'
import { EmptyState } from '@/components/ui/empty-state'
import { UsersIcon, SearchXIcon } from 'lucide-react'

// Whitelists y appliers de filtros viven en lib/admin/query-builders
// (compartidos con el export CSV). Solo se importa el tipo para anotar.
type StatusFilter =
  (typeof CUSTOMER_STATUS_FILTERS)[number]
type SortColumn = (typeof SORTABLE_CUSTOMERS)[number]

export default async function UsuariosPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string
    q?: string
    status?: string
    sort?: string
    dir?: string
  }>
}) {
  const supabase = await createClient()
  const { page, q, status, sort, dir } = await searchParams
  const query = (q ?? '').trim()
  // El saneo del término y la construcción del or() viven en
  // query-builders (compartido con el export CSV).

  const statusFilter = parseStatusFilter(CUSTOMER_STATUS_FILTERS, status)
  const sortColumn = parseSortColumn(SORTABLE_CUSTOMERS, sort)
  const effectiveDir = parseSortDir(dir)

  /**
   * hasOrders se calcula DESPUÉS de traer la página (batch sobre ids ya
   * paginados), así que filtrar por ese flag exige INVERTIR el orden:
   * primero el set de customer_id con pedidos y usarlo como .in() /
   * .not.in() ANTES de paginar. Para volúmenes medianos es aceptable;
   * si orders crece mucho, evaluar columna desnormalizada
   * profiles.has_orders actualizada por trigger (nota en Fase 9).
   */
  async function customerIdsWithOrders(): Promise<string[] | null> {
    // Solo se necesita cuando el filtro lo exige.
    if (statusFilter !== 'with_orders' && statusFilter !== 'without_orders') {
      return null
    }
    return fetchCustomerIdsWithOrders(supabase)
  }

  function countRows(idsWithOrders: string[] | null) {
    let builder = supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('role', 'CUSTOMER')
    builder = applyCustomerFilters(builder, {
      query,
      status: statusFilter,
      idsWithOrders,
    })
    return builder
  }

  function dataRows(idsWithOrders: string[] | null) {
    const builder = supabase
      .from('profiles')
      .select('id, full_name, email, anonymized_at, created_at')
      .eq('role', 'CUSTOMER')
      .order(sortColumn ?? 'created_at', { ascending: effectiveDir === 'asc' })
    return applyCustomerFilters(builder, {
      query,
      status: statusFilter,
      idsWithOrders,
    })
  }

  // El count aplica EXACTAMENTE los mismos filtros que los datos, para que
  // el total del paginado sea el del resultado filtrado (applier compartido
  // con el export CSV).

  const idsWithOrders = await customerIdsWithOrders()

  // El offset se deriva del parámetro de página (sin conocer el total)
  // para lanzar count y data en paralelo: 1 round-trip en vez de 2.
  const offset = (parsePage(page) - 1) * PAGE_SIZE

  const [countResult, dataResult] = await Promise.all([
    countRows(idsWithOrders),
    dataRows(idsWithOrders).range(offset, offset + PAGE_SIZE - 1),
  ])

  const total = countResult.count ?? 0
  const pagination = getPagination(total, page)

  let rows = dataResult.data
  let error = dataResult.error

  // Página fuera de rango (p. ej. ?page=999): el offset pedido no coincide
  // con el ya recortado contra el total — reconsulta una sola vez.
  if (!error && pagination.start !== offset) {
    const retry = await dataRows(idsWithOrders).range(
      pagination.start,
      pagination.start + PAGE_SIZE - 1
    )
    rows = retry.data
    error = retry.error
  }

  /** Flags hasOrders de TODA la página en UN solo batch: cero N+1. Service
   * role porque el conteo cruza pedidos de todos los clientes (el admin
   * autenticado solo vería los suyos por RLS de orders). Decide si el admin
   * ve "Eliminar" (sin historial → hard delete) o "Desactivar y anonimizar"
   * (con historial → la cuenta nunca se purga de auth.users). */
  async function fetchHasOrdersMap(profileIds: string[]) {
    if (profileIds.length === 0) return new Map<string, boolean>()
    const { data } = await supabase
      .from('orders')
      .select('customer_id')
      .in('customer_id', profileIds)
    const withOrders = new Set((data ?? []).map((row) => row.customer_id))
    return new Map(profileIds.map((id) => [id, withOrders.has(id)]))
  }

  const rowsForFlags = error ? [] : (rows ?? []).map((r) => r.id)
  const hasOrdersMap = await fetchHasOrdersMap(rowsForFlags)

  // La fecha se formatea aquí (Server Component) y el cliente solo renderiza
  // el string: evita mismatches de hidratación por diferencias de ICU entre
  // Node y el navegador.
  const customers: CustomerRow[] | null = error
    ? null
    : rows?.map((row) => ({
        ...row,
        hasOrders: hasOrdersMap.get(row.id) ?? false,
        anonymized: row.anonymized_at !== null,
        anonymizedAt: row.anonymized_at
          ? new Date(row.anonymized_at).toLocaleDateString('es-PE', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
            })
          : null,
        registered: new Date(row.created_at).toLocaleDateString('es-PE', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        }),
      })) ?? null

  const basePath = buildBasePath(query, statusFilter, sortColumn, effectiveDir)

  return (
    <PageContainer size="full">
      <PageHeader
        title="Usuarios"
        description="Revisa y administra los clientes que se registraron con su cuenta de Google."
      />

      {error && (
        <p role="alert" className="mt-6 text-sm text-destructive">
          No se pudo cargar la lista de clientes.
        </p>
      )}

      {!error && customers && customers.length > 0 && (
        <CustomerTable
          customers={customers}
          initialQuery={query}
          startIndex={pagination.start}
          currentStatus={statusFilter ?? ''}
          currentSort={sortColumn ?? ''}
          currentDir={effectiveDir}
          pagination={{
            page: pagination.page,
            pageCount: pagination.pageCount,
            basePath,
          }}
        />
      )}

      {!error && total === 0 && (
        <EmptyState
          icon={query || statusFilter ? SearchXIcon : UsersIcon}
          title={
            query
              ? `No se encontraron clientes para "${query}"`
              : statusFilter
                ? 'No hay clientes con ese criterio'
                : 'Todavía no hay clientes registrados'
          }
          description={
            query
              ? 'Prueba con otro nombre o correo.'
              : 'Las cuentas de clientes aparecerán aquí cuando se registren.'
          }
          className="mt-10"
        />
      )}
    </PageContainer>
  )
}

function buildBasePath(
  query: string,
  statusFilter?: StatusFilter,
  sortColumn?: SortColumn,
  dir?: 'asc' | 'desc'
) {
  const params = new URLSearchParams()
  if (query) params.set('q', query)
  if (statusFilter) params.set('status', statusFilter)
  // El orden activo viaja en la paginación para no perderlo al cambiar de página.
  if (sortColumn) {
    params.set('sort', sortColumn)
    params.set('dir', dir ?? 'asc')
  }
  const qs = params.toString()
  return qs ? `/admin/usuarios?${qs}` : '/admin/usuarios'
}
