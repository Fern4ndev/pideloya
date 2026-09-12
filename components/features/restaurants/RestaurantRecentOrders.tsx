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

async function getMyRestaurantId(supabase: Awaited<ReturnType<typeof createClient>>) {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('auth_id', user.id)
    .single()

  if (!profile) return null

  const { data: member } = await supabase
    .from('restaurant_members')
    .select('restaurant_id')
    .eq('user_id', profile.id)
    .single()

  return member?.restaurant_id as string | null
}

export async function RestaurantRecentOrders() {
  const supabase = await createClient()
  const restaurantId = await getMyRestaurantId(supabase)

  if (!restaurantId) return null

  // Obtener pedidos que incluyen productos de este restaurante
  const { data: orderItems } = await supabase
    .from('order_items')
    .select('order_id')
    .eq('restaurant_id', restaurantId)
    .order('created_at', { ascending: false })
    .limit(20)

  if (!orderItems || orderItems.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pedidos recientes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
            No hay pedidos con tus productos aún.
          </div>
        </CardContent>
      </Card>
    )
  }

  // Obtener IDs únicos de pedidos
  const uniqueOrderIds = [...new Set(orderItems.map((item) => item.order_id))].slice(0, 10)

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
        quantity
      )
    `)
    .in('id', uniqueOrderIds)
    .order('created_at', { ascending: false })

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
                <TableHead>Items</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Fecha</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((order) => {
                const customerName = (order.profiles as unknown as { full_name: string } | null)?.full_name ?? '—'
                const items = (order.order_items as unknown as { product_name: string; quantity: number }[] | null) ?? []
                const itemsText = items.map((i) => `${i.quantity}x ${i.product_name}`).join(', ')
                const createdAt = new Date(order.created_at)

                return (
                  <TableRow key={order.id}>
                    <TableCell className="font-medium">{customerName}</TableCell>
                    <TableCell className="max-w-[200px] truncate text-muted-foreground">
                      {itemsText || '—'}
                    </TableCell>
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
