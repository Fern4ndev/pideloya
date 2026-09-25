import { createClient } from '@/lib/db/server'
import { CustomerTable } from '@/components/features/admin/CustomerTable'
import { TablePagination } from '@/components/ui/table-pagination'
import { getPagination } from '@/lib/pagination'
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

  const countBuilder = supabase
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('role', 'CUSTOMER')
  const countQuery = orFilter ? countBuilder.or(orFilter) : countBuilder
  const total = (await countQuery).count ?? 0
  const pagination = getPagination(total, page)

  const dataBuilder = supabase
    .from('profiles')
    .select('id, full_name, email, created_at')
    .eq('role', 'CUSTOMER')
    .order('created_at', { ascending: false })
  const dataQuery = orFilter ? dataBuilder.or(orFilter) : dataBuilder
  const { data: customers, error } = await dataQuery.range(
    pagination.start,
    pagination.end - 1
  )

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
          <TablePagination
            basePath={basePath}
            page={pagination.page}
            pageCount={pagination.pageCount}
          />
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
