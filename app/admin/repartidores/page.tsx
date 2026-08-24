import { createClient } from '@/lib/db/server'
import { approveDeliveryPerson } from '@/lib/actions/admin'
import { ApproveButton } from '@/components/features/admin/ApproveButton'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

export default async function AdminDeliveryPage() {
  const supabase = await createClient()

  const { data: deliveryPeople, error } = await supabase
    .from('profiles')
    .select('id, full_name, phone, document_type, document_number, vehicle_type, is_active')
    .eq('role', 'DELIVERY')
    .order('created_at', { ascending: false })

  return (
    <div>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Repartidores
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Revisa y aprueba a los repartidores que se registraron desde la
          página principal.
        </p>
      </div>

      {error && (
        <p className="mt-6 text-sm text-destructive">
          No se pudo cargar la lista de repartidores.
        </p>
      )}

      {!error && deliveryPeople && deliveryPeople.length > 0 && (
        <Table className="mt-6">
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Documento</TableHead>
              <TableHead>Vehículo</TableHead>
              <TableHead>Teléfono</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Acción</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {deliveryPeople.map((d) => (
              <TableRow key={d.id}>
                <TableCell className="font-medium">{d.full_name}</TableCell>
                <TableCell className="text-muted-foreground">
                  {d.document_type ? `${d.document_type} ${d.document_number}` : '—'}
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
                    <Badge variant="outline">Pendiente</Badge>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {!d.is_active && (
                    <ApproveButton id={d.id} action={approveDeliveryPerson} />
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {!error && deliveryPeople && deliveryPeople.length === 0 && (
        <p className="mt-10 text-center text-sm text-muted-foreground">
          Todavía no hay repartidores registrados.
        </p>
      )}
    </div>
  )
}