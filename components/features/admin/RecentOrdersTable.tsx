import { createClient } from '@/lib/db/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { OrderStatusBadge } from '@/components/features/orders/OrderStatusBadge'

export async function RecentOrdersTable() {
  const supabase = await createClient()

  const { data: orders } = await supabase
    .from('orders')
    .select(`
      id,
      status,
      total,
      created_at,
      customer_name,
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
                // Snapshot primero; el join a profiles es solo fallback
                // para pedidos anteriores al backfill (si los hubiera).
                const customerName =
                  order.customer_name ??
                  (order.profiles as unknown as { full_name: string } | null)?.full_name ??
                  '—'
                const restaurantName = (order.order_items?.[0] as unknown as { restaurant_name: string | null } | null)?.restaurant_name ?? '—'
                const createdAt = new Date(order.created_at)

                return (
                  <TableRow key={order.id}>
                    <TableCell className="font-medium">{customerName}</TableCell>
                    <TableCell className="text-muted-foreground">{restaurantName}</TableCell>
                    <TableCell>
                      <OrderStatusBadge status={order.status} />
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      S/ {Number(order.total).toFixed(2)}
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
