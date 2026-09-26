import { createClient } from '@/lib/db/server'
import {
  DeliveryTable,
  type DeliveryRow,
} from '@/components/features/admin/DeliveryTable'
import { getPagination, parsePage, PAGE_SIZE } from '@/lib/pagination'
import {
  DELIVERY_STATUS_FILTERS,
  SORTABLE_DELIVERIES,
  applyDeliveryFilters,
  fetchDeliveryPersonIdsOnRoute,
  parseSortColumn,
  parseSortDir,
  parseStatusFilter,
} from '@/lib/admin/query-builders'
import { PageHeader } from '@/components/layout/PageHeader'
import { PageContainer } from '@/components/layout/PageContainer'
import { EmptyState } from '@/components/ui/empty-state'
import { RealtimeRefresh } from '@/components/ui/realtime-refresh'
import { BikeIcon, SearchXIcon } from 'lucide-react'

const DELIVERY_COLUMNS =
  'id, full_name, phone, document_type, document_number, vehicle_type, is_active, anonymized_at, created_at'

// Whitelists y appliers de filtros viven en lib/admin/query-builders
// (compartidos con el export CSV).
type StatusFilter = (typeof DELIVERY_STATUS_FILTERS)[number]
type SortColumn = (typeof SORTABLE_DELIVERIES)[number]

export default async function AdminDeliveryPage({
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

  // Whitelists, saneo y construcción del or() viven en query-builders
  // (compartidos con el export CSV).
  const statusFilter = parseStatusFilter(DELIVERY_STATUS_FILTERS, status)
  const sortColumn = parseSortColumn(SORTABLE_DELIVERIES, sort)
  const effectiveDir = parseSortDir(dir)

  function countRows(onRouteIds: string[] | null) {
    let builder = supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('role', 'DELIVERY')
    builder = applyDeliveryFilters(builder, {
      query,
      status: statusFilter,
      onRouteIds,
    })
    return builder
  }

  function dataRows(onRouteIds: string[] | null) {
    const builder = supabase
      .from('profiles')
      .select(DELIVERY_COLUMNS)
      .eq('role', 'DELIVERY')
      .order(sortColumn ?? 'created_at', { ascending: effectiveDir === 'asc' })
    return applyDeliveryFilters(builder, {
      query,
      status: statusFilter,
      onRouteIds,
    })
  }

  // El count aplica EXACTAMENTE los mismos filtros que los datos, para que
  // el total del paginado sea el del resultado filtrado (applier compartido
  // con el export CSV).

  /** Set de repartidores con entrega activa (ASSIGNED/PICKED_UP/ON_THE_WAY).
   * Solo se consulta cuando el filtro `on_route` está activo: usa los mismos
   * estados que la guarda de deactivateUser (delivery-lifecycle.ts). */
  async function deliveryPersonIdsOnRoute(): Promise<string[] | null> {
    if (statusFilter !== 'on_route') return null
    return fetchDeliveryPersonIdsOnRoute(supabase)
  }

  const onRouteIds = await deliveryPersonIdsOnRoute()

  // El offset se deriva del parámetro de página (sin conocer el total)
  // para lanzar count y data en paralelo: 1 round-trip en vez de 2.
  const offset = (parsePage(page) - 1) * PAGE_SIZE

  const [countResult, dataResult] = await Promise.all([
    countRows(onRouteIds),
    dataRows(onRouteIds).range(offset, offset + PAGE_SIZE - 1),
  ])

  const total = countResult.count ?? 0
  const pagination = getPagination(total, page)

  let rows = dataResult.data
  let error = dataResult.error

  // Página fuera de rango (p. ej. ?page=999): el offset pedido no coincide
  // con el ya recortado contra el total — reconsulta una sola vez.
  if (!error && pagination.start !== offset) {
    const retry = await dataRows(onRouteIds).range(
      pagination.start,
      pagination.start + PAGE_SIZE - 1
    )
    rows = retry.data
    error = retry.error
  }

  /**
   * Flag hasDeliveries de TODA la página en UN solo batch (deliveries
   * WHERE delivery_person_id IN ...): cero N+1. Service role porque
   * el conteo cruza entregas de todos los repartidores (por RLS, el
   * repartidor autenticado solo vería las suyas). Decide si el botón
   * desactiva/elimina de verdad o es solo cosmético (el servidor
   * anonimiza y banea en vez de borrar).
   */
  async function fetchHasDeliveriesMap(profileIds: string[]) {
    if (profileIds.length === 0) return new Map<string, boolean>()
    const { data } = await supabase
      .from('deliveries')
      .select('delivery_person_id')
      .in('delivery_person_id', profileIds)
    const withDeliveries = new Set(
      (data ?? []).map((row) => row.delivery_person_id)
    )
    return new Map(profileIds.map((id) => [id, withDeliveries.has(id)]))
  }

  const rowsForFlags = error ? [] : (rows ?? []).map((r) => r.id)
  const hasDeliveriesMap = await fetchHasDeliveriesMap(rowsForFlags)

  // La fecha se formatea aquí (Server Component) y el cliente solo renderiza
  // el string: evita mismatches de hidratación por diferencias de ICU entre
  // Node y el navegador.
  const deliveries: DeliveryRow[] | null = error
    ? null
    : (rows ?? []).map((row) => ({
        ...row,
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
      }))

  const basePath = buildBasePath(query, statusFilter, sortColumn, effectiveDir)

  return (
    <PageContainer size="full">
      {/* Fase 10: un repartidor nuevo registrado desde /registro aparece
       * sin refrescar. INSERT + filtro server-side role=DELIVERY: los
       * INSERT de perfiles de clientes (la mayoría) no disparan refresh. */}
      <RealtimeRefresh
        channelName="admin-repartidores"
        table="profiles"
        event="INSERT"
        filter="role=eq.DELIVERY"
      />

      <PageHeader
        title="Repartidores"
        description="Revisa y administra a los repartidores que se registraron desde la página principal."
      />

      {error && (
        <p role="alert" className="mt-6 text-sm text-destructive">
          No se pudo cargar la lista de repartidores.
        </p>
      )}

      {!error && deliveries && deliveries.length > 0 && (
        <DeliveryTable
          deliveries={deliveries}
          initialQuery={query}
          startIndex={pagination.start}
          currentStatus={statusFilter ?? ''}
          currentSort={sortColumn ?? ''}
          currentDir={effectiveDir}
          hasDeliveriesMap={Object.fromEntries(hasDeliveriesMap)}
          pagination={{
            page: pagination.page,
            pageCount: pagination.pageCount,
            basePath,
          }}
        />
      )}

      {!error && total === 0 && (
        <EmptyState
          icon={query || statusFilter ? SearchXIcon : BikeIcon}
          title={
            query
              ? `No se encontraron repartidores para "${query}"`
              : statusFilter
                ? 'No hay repartidores con ese estado'
                : 'Todavía no hay repartidores registrados'
          }
          description={
            query
              ? 'Prueba con otro nombre, DNI o teléfono.'
              : 'Las cuentas de repartidores aparecerán aquí cuando se registren.'
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
  return qs ? `/admin/repartidores?${qs}` : '/admin/repartidores'
}
