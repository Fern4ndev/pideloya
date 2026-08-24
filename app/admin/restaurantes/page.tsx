import { createClient } from '@/lib/db/server'
import { approveRestaurant } from '@/lib/actions/admin'
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

export default async function AdminRestaurantsPage() {
  const supabase = await createClient()

  const { data: restaurants, error } = await supabase
    .from('restaurants')
    .select(
      'id, name, slug, address_text, whatsapp, food_type, is_approved, is_active, restaurant_members(profiles(full_name))'
    )
    .order('created_at', { ascending: false })

  return (
    <div>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Restaurantes
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Revisa y aprueba los negocios que se registraron desde la página
          principal.
        </p>
      </div>

      {error && (
        <p className="mt-6 text-sm text-destructive">
          No se pudo cargar la lista de restaurantes.
        </p>
      )}

      {!error && restaurants && restaurants.length > 0 && (
        <Table className="mt-6">
          <TableHeader>
            <TableRow>
              <TableHead>Negocio</TableHead>
              <TableHead>Dueño</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>WhatsApp</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Acción</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {restaurants.map((r) => {
              const ownerName =
                r.restaurant_members?.[0]?.profiles?.full_name ?? '—'
              return (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell>{ownerName}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {r.food_type ?? '—'}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {r.whatsapp ?? '—'}
                  </TableCell>
                  <TableCell>
                    {r.is_approved ? (
                      <Badge variant="secondary">Aprobado</Badge>
                    ) : (
                      <Badge variant="outline">Pendiente</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {!r.is_approved && (
                      <ApproveButton id={r.id} action={approveRestaurant} />
                    )}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      )}

      {!error && restaurants && restaurants.length === 0 && (
        <p className="mt-10 text-center text-sm text-muted-foreground">
          Todavía no hay restaurantes registrados.
        </p>
      )}
    </div>
  )
}