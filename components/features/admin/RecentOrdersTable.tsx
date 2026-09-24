import { createClient } from '@/lib/db/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  PENDING: 'outline',
  ASSIGNED: 'secondary',
  PICKED_UP: 'secondary',
  ON_THE_WAY: 'secondary',
  DELIVERED: 'default',
  CANCELLED: 'destructive',
}

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pendiente',
  ASSIGNED: 'Asignado',
  PICKED_UP: 'Recogido',
  ON_THE_WAY: 'En camino',
  DELIVERED: 'Entregado',
  CANCELLED: 'Cancelado',
}

export async function RecentOrdersTable() {
  const supabase = await createClient()

  const { data: orders } = await supabase
    .from('orders')
    .select(`
      id,
      status,
      total,
      created_at,
      profiles:customer_id ( full_name ),
      order_items (
        product_name,
        restaurant_name
      )
    `)
    .order('created_at', { ascending: false })
    .limit(10)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Pedidos recientes</CardTitle>
      </CardHeader>
      <CardContent>
        {orders && orders.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Restaurante</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Fecha</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((order) => {
                const customerName = (order.profiles as unknown as { full_name: string } | null)?.full_name ?? '—'
                const restaurantName = (order.order_items?.[0] as unknown as { restaurant_name: string | null } | null)?.restaurant_name ?? '—'
                const createdAt = new Date(order.created_at)

                return (
                  <TableRow key={order.id}>
                    <TableCell className="font-medium">{customerName}</TableCell>
                    <TableCell className="text-muted-foreground">{restaurantName}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[order.status] ?? 'outline'}>
                        {STATUS_LABELS[order.status] ?? order.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      S/ {order.total.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {createdAt.toLocaleDateString('es-PE', {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        ) : (
          <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
            No hay pedidos registrados aún.
          </div>
        )}
      </CardContent>
    </Card>
  )
}
