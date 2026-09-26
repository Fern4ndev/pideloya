import { createClient } from '@/lib/db/server'
import {
  RestaurantTable,
  type RestaurantRow,
} from '@/components/features/admin/RestaurantTable'
import { getPagination, parsePage, PAGE_SIZE } from '@/lib/pagination'
import {
  RESTAURANT_STATUS_FILTERS,
  SORTABLE_RESTAURANTS,
  applyRestaurantFilters,
  parseSortColumn,
  parseSortDir,
  parseStatusFilter,
} from '@/lib/admin/query-builders'
import { PageHeader } from '@/components/layout/PageHeader'
import { PageContainer } from '@/components/layout/PageContainer'
import { EmptyState } from '@/components/ui/empty-state'
import { RealtimeRefresh } from '@/components/ui/realtime-refresh'
import { StoreIcon, SearchXIcon } from 'lucide-react'

const RESTAURANT_COLUMNS =
  'id, name, slug, address_text, whatsapp, food_type, is_approved, is_active, created_at, restaurant_members(profiles(full_name))'

// El ordenamiento por dueño usa la referencia anidada; PostgREST no
// permite order() cruzado, así que se resuelve en memoria tras traer
// la página (limitación aceptada: la paginación física sigue por created_at).
const OWNER_SORT_KEY = 'owner'

export default async function AdminRestaurantsPage({
  searchParams,
}: {
  // status: 'pending' | 'active' | 'suspended' — validado contra whitelist.
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

  // Whitelists compartidas con el export (lib/admin/query-builders):
  // cualquier valor fuera de la lista se ignora.
  const statusFilter = parseStatusFilter(RESTAURANT_STATUS_FILTERS, status)
  const sortColumn = parseSortColumn(SORTABLE_RESTAURANTS, sort)
  const effectiveDir = parseSortDir(dir)
  const isOwnerSort = sort === OWNER_SORT_KEY

  function countRows() {
    let builder = supabase
      .from('restaurants')
      .select('id', { count: 'exact', head: true })
    builder = applyRestaurantFilters(builder, { query, status: statusFilter })
    return builder
  }

  function dataRows() {
    let builder = supabase
      .from('restaurants')
      .select(RESTAURANT_COLUMNS)
    builder = applyRestaurantFilters(builder, { query, status: statusFilter })
    if (isOwnerSort) {
      builder = builder.order('created_at', { ascending: false })
    } else {
      builder = builder.order(sortColumn ?? 'created_at', {
        ascending: effectiveDir === 'asc',
      })
    }
    return builder
  }

  // El count aplica EXACTAMENTE los mismos filtros que los datos, para que
  // el total del paginado sea el del resultado filtrado. La definición de
  // filtros vive en query-builders (compartida con el export CSV).

  // El offset se deriva del parámetro de página (sin conocer el total)
  // para lanzar count y data en paralelo: 1 round-trip en vez de 2.
  const offset = (parsePage(page) - 1) * PAGE_SIZE

  const [countResult, dataResult] = await Promise.all([
    countRows(),
    dataRows().range(offset, offset + PAGE_SIZE - 1),
  ])

  const total = countResult.count ?? 0
  const pagination = getPagination(total, page)

  let rows = dataResult.data
  let error = dataResult.error

  // Página fuera de rango (p. ej. ?page=999): el offset pedido no coincide
  // con el ya recortado contra el total — reconsulta una sola vez.
  if (!error && pagination.start !== offset) {
    const retry = await dataRows().range(
      pagination.start,
      pagination.start + PAGE_SIZE - 1
    )
    rows = retry.data
    error = retry.error
  }

  let sortedRows = rows
  if (!error && isOwnerSort && rows && rows.length > 0) {
    // Ordenamiento por dueño EN MEMORIA sobre la página actual: la columna
    // pertenece a la relación embebida y PostgREST no permite order()
    // cruzado de tablas. Limitación aceptada: la paginación sigue siendo
    // por created_at (el orden por dueño reordena dentro de cada página).
    sortedRows = [...rows].sort((a, b) => {
      const nameA = a.restaurant_members?.[0]?.profiles?.full_name ?? ''
      const nameB = b.restaurant_members?.[0]?.profiles?.full_name ?? ''
      const cmp = nameA.localeCompare(nameB, 'es', { sensitivity: 'base' })
      return effectiveDir === 'asc' ? cmp : -cmp
    })
  }

  // La fecha se formatea aquí (Server Component) y el cliente solo renderiza
  // el string: evita mismatches de hidratación por diferencias de ICU entre
  // Node y el navegador.
  const restaurants: RestaurantRow[] | null = error
    ? null
    : (sortedRows ?? []).map((row) => ({
        ...row,
        registered: new Date(row.created_at).toLocaleDateString('es-PE', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        }),
      }))

  const basePath = buildBasePath(query, statusFilter, sort, effectiveDir)

  return (
    <PageContainer size="full">
      {/* Fase 10: un restaurante nuevo registrado desde /registro aparece
       * sin refrescar. INSERT + filtro server-side is_approved=false: las
       * ediciones/aprobaciones de filas ya existentes NO disparan refresh
       * (el admin está viendo la lista; su acción ya la re-renderiza). */}
      <RealtimeRefresh
        channelName="admin-restaurantes"
        table="restaurants"
        event="INSERT"
        filter="is_approved=eq.false"
      />

      <PageHeader
        title="Restaurantes"
        description="Revisa y administra los negocios que se registraron desde la página principal."
      />

      {error && (
        <p role="alert" className="mt-6 text-sm text-destructive">
          No se pudo cargar la lista de restaurantes.
        </p>
      )}

      {!error && restaurants && restaurants.length > 0 && (
        <RestaurantTable
          restaurants={restaurants}
          initialQuery={query}
          startIndex={pagination.start}
          currentStatus={statusFilter ?? ''}
          currentSort={sort ?? ''}
          currentDir={effectiveDir}
          pagination={{
            page: pagination.page,
            pageCount: pagination.pageCount,
            basePath,
          }}
        />
      )}

      {!error && restaurants && restaurants.length === 0 && (
        <EmptyState
          icon={query || statusFilter ? SearchXIcon : StoreIcon}
          title={
            query
              ? `No se encontraron restaurantes para "${query}"`
              : statusFilter
                ? 'No hay restaurantes con ese estado'
                : 'Todavía no hay restaurantes registrados'
          }
          description={
            query
              ? 'Prueba con otro nombre, dueño o tipo de comida.'
              : 'Los negocios que se registren desde la página principal aparecerán aquí.'
          }
          className="mt-10"
        />
      )}
    </PageContainer>
  )
}

function buildBasePath(
  query: string,
  statusFilter?: string,
  sort?: string,
  dir?: string
) {
  const params = new URLSearchParams()
  if (query) params.set('q', query)
  if (statusFilter) params.set('status', statusFilter)
  if (sort && (SORTABLE_RESTAURANTS as readonly string[]).includes(sort)) {
    params.set('sort', sort)
    params.set('dir', dir ?? 'asc')
  }
  const qs = params.toString()
  return qs ? `/admin/restaurantes?${qs}` : '/admin/restaurantes'
}
