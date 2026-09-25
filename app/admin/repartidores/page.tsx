import { createClient } from '@/lib/db/server'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { DeliveryRowActions } from '@/components/features/admin/DeliveryRowActions'
import { TablePagination } from '@/components/ui/table-pagination'
import { getPagination } from '@/lib/pagination'
import { PageHeader } from '@/components/layout/PageHeader'
import { PageContainer } from '@/components/layout/PageContainer'
import { TableShell } from '@/components/ui/table-shell'
import { EmptyState } from '@/components/ui/empty-state'
import { BikeIcon } from 'lucide-react'

export default async function AdminDeliveryPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>
}) {
  const supabase = await createClient()
  const { page } = await searchParams

  const getAll = supabase
    .from('profiles')
    .select(
      'id, full_name, phone, document_type, document_number, vehicle_type, is_active, created_at',
      { count: 'exact', head: true }
    )
    .eq('role', 'DELIVERY')

  const total = (await getAll).count ?? 0
  const pagination = getPagination(total, page)

  const { data: pagedDeliveryPeople, error: pagedError } = await supabase
    .from('profiles')
    .select(
      'id, full_name, phone, document_type, document_number, vehicle_type, is_active, created_at'
    )
    .eq('role', 'DELIVERY')
    .order('created_at', { ascending: false })
    .range(pagination.start, pagination.end - 1)

  return (
    <PageContainer size="full">
      <PageHeader
        title="Repartidores"
        description="Revisa y administra a los repartidores que se registraron desde la página principal."
      />

      {pagedError && (
        <p role="alert" className="mt-6 text-sm text-destructive">
          No se pudo cargar la lista de repartidores.
        </p>
      )}

      {!pagedError && pagedDeliveryPeople && pagedDeliveryPeople.length > 0 && (
        <>
          <TableShell className="mt-6">
            <Table className="table-fixed">
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">N°</TableHead>
              <TableHead className="w-48">Nombre</TableHead>
              <TableHead className="w-24">DNI</TableHead>
              <TableHead className="w-28">Vehículo</TableHead>
              <TableHead className="w-24">Teléfono</TableHead>
              <TableHead className="w-24">Estado</TableHead>
              <TableHead className="w-28 text-center">Registro</TableHead>
              <TableHead className="w-20">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pagedDeliveryPeople.map((d, index) => {
              const createdAt = new Date(d.created_at)

              return (
                <TableRow key={d.id}>
                  <TableCell className="text-muted-foreground">
                    {pagination.start + index + 1}
                  </TableCell>
                  <TableCell className="max-w-48 truncate font-medium" title={d.full_name ?? ''}>{d.full_name}</TableCell>
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
                    {createdAt.toLocaleDateString('es-PE', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </TableCell>
                  <TableCell>
                    <DeliveryRowActions
                      id={d.id}
                      isActive={d.is_active}
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

          <div className="mt-4 flex justify-end">
            <TablePagination
              basePath="/admin/repartidores"
              page={pagination.page}
              pageCount={pagination.pageCount}
              alwaysShow={true}
            />
          </div>
        </>
      )}

      {!pagedError && total === 0 && (
        <EmptyState
          icon={BikeIcon}
          title="Todavía no hay repartidores registrados"
          description="Las cuentas de repartidores aparecerán aquí cuando se registren."
          className="mt-10"
        />
      )}
    </PageContainer>
  )
}
