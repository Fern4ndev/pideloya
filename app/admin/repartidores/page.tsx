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
    <div>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Repartidores
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Revisa y administra a los repartidores que se registraron desde la
          página principal.
        </p>
      </div>

      {pagedError && (
        <p className="mt-6 text-sm text-destructive">
          No se pudo cargar la lista de repartidores.
        </p>
      )}

      {!pagedError && pagedDeliveryPeople && pagedDeliveryPeople.length > 0 && (
        <Table className="mt-6">
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">N°</TableHead>
              <TableHead>Nombre</TableHead>
              <TableHead>Documento</TableHead>
              <TableHead>Vehículo</TableHead>
              <TableHead className="w-28">Teléfono</TableHead>
              <TableHead className="w-24">Estado</TableHead>
              <TableHead className="w-20 text-right">Registro</TableHead>
              <TableHead className="w-12" />
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
                  <TableCell className="font-medium">{d.full_name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {d.document_type
                      ? `${d.document_type} ${d.document_number}`
                      : '—'}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {d.vehicle_type ?? '—'}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {d.phone ?? '—'}
                  </TableCell>
                  <TableCell>
                    {d.is_active ? (
                      <Badge variant="secondary">Activo</Badge>
                    ) : (
                      <Badge variant="outline">Inactivo</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
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
      )}

      {!pagedError && pagedDeliveryPeople && pagedDeliveryPeople.length > 0 && (
        <TablePagination
          basePath="/admin/repartidores"
          page={pagination.page}
          pageCount={pagination.pageCount}
        />
      )}

      {!pagedError && total === 0 && (
        <p className="mt-10 text-center text-sm text-muted-foreground">
          Todavía no hay repartidores registrados.
        </p>
      )}
    </div>
  )
}
