import { createClient } from '@/lib/db/server'
import {
  CustomerTable,
  type CustomerRow,
} from '@/components/features/admin/CustomerTable'
import { TablePagination } from '@/components/ui/table-pagination'
import { getPagination, parsePage, PAGE_SIZE } from '@/lib/pagination'
import { PageHeader } from '@/components/layout/PageHeader'
import { PageContainer } from '@/components/layout/PageContainer'
import { EmptyState } from '@/components/ui/empty-state'
import { UsersIcon, SearchXIcon } from 'lucide-react'

export default async function UsuariosPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string }>
}) {
  const supabase = await createClient()
  const { page, q } = await searchParams
  const query = (q ?? '').trim()
  const safe = query.replace(/[%_,()]/g, ' ')
  const orFilter = query
    ? `full_name.ilike.%${safe}%,email.ilike.%${safe}%`
    : null

  function countRows() {
    const builder = supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('role', 'CUSTOMER')
    return orFilter ? builder.or(orFilter) : builder
  }

  function dataRows() {
    const builder = supabase
      .from('profiles')
      .select('id, full_name, email, created_at')
      .eq('role', 'CUSTOMER')
      .order('created_at', { ascending: false })
    return orFilter ? builder.or(orFilter) : builder
  }

  /**
   * Flags hasOrders de TODA la página en UN solo batch: orders WHERE
   * customer_id IN (...ids de la página). Cero N+1. Se hace con service
   * role porque el conteo cruza pedidos de todos los clientes (el admin
   * autenticado solo vería los suyos por RLS de orders).
   */
  async function fetchHasOrdersMap(profileIds: string[]) {
    if (profileIds.length === 0) return new Map<string, boolean>()
    const { data } = await supabase
      .from('orders')
      .select('customer_id')
      .in('customer_id', profileIds)
    const withOrders = new Set((data ?? []).map((row) => row.customer_id))
    return new Map(profileIds.map((id) => [id, withOrders.has(id)]))
  }

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

  // La fecha se formatea aquí (Server Component) y el cliente solo renderiza
  // el string: evita mismatches de hidratación por diferencias de ICU entre
  // Node y el navegador.
  // El flag hasOrders decide si el admin ve "Eliminar" (sin historial →
  // hard delete) o "Desactivar y anonimizar" (con historial → la cuenta
  // nunca se purga de auth.users). También se resuelve si la página
  // está fuera de rango (el retry trae filas distintas).
  const rowsForFlags = error ? [] : (rows ?? []).map((r) => r.id)
  const hasOrdersMap = await fetchHasOrdersMap(rowsForFlags)

  const customers: CustomerRow[] | null = error
    ? null
    : rows?.map((row) => ({
        ...row,
        hasOrders: hasOrdersMap.get(row.id) ?? false,
        registered: new Date(row.created_at).toLocaleDateString('es-PE', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        }),
      })) ?? null

  const basePath = query
    ? `/admin/usuarios?q=${encodeURIComponent(query)}`
    : '/admin/usuarios'

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
        <>
          <CustomerTable
            customers={customers}
            initialQuery={query}
            startIndex={pagination.start}
          />
          <div className="mt-4 flex justify-end">
            <TablePagination
              basePath={basePath}
              page={pagination.page}
              pageCount={pagination.pageCount}
              alwaysShow={true}
            />
          </div>
        </>
      )}

      {!error && total === 0 && (
        <EmptyState
          icon={query ? SearchXIcon : UsersIcon}
          title={
            query
              ? `No se encontraron clientes para "${query}"`
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
