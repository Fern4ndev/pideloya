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
import { DeliveryDetailsDialog } from '@/components/features/deliveries/DeliveryDetailsDialog'
import { TablePagination } from '@/components/ui/table-pagination'
import { getPagination } from '@/lib/pagination'
import { PackageIcon } from 'lucide-react'
import type { OrderStatus } from '@/lib/constants/order-status'

async function getMyProfileId(supabase: Awaited<ReturnType<typeof createClient>>) {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('auth_id', user.id)
    .single()

  return (profile?.id as string) ?? null
}

type DeliveryRow = {
  id: string
  accepted_at: string | null
  delivered_at: string | null
  orders: {
    status: OrderStatus
    total: number
    created_at: string
    addresses: { address_text: string } | null
    order_items:
      | {
          product_name: string | null
          quantity: number
          restaurant_name: string | null
        }[]
      | null
  } | null
}

/**
 * Historial completo de entregas del repartidor autenticado — reutiliza
 * el mismo patrón de tabla que RestaurantRecentOrders/RecentOrdersTable
 * (Card + Table) y el mismo OrderStatusBadge que ya usan pedidos y
 * "Mis entregas", en vez de redefinir los colores/labels de estado.
 */
export async function DeliveryHistoryTable({ page }: { page?: string }) {
  const supabase = await createClient()
  const profileId = await getMyProfileId(supabase)

  if (!profileId) return null

  const getTotal = supabase
    .from('deliveries')
    .select('id', { count: 'exact', head: true })
    .eq('delivery_person_id', profileId)

  const total = (await getTotal).count ?? 0
  const pagination = getPagination(total, page)

  const { data: deliveries, error } = await supabase
    .from('deliveries')
    .select(
      `
      id,
      accepted_at,
      delivered_at,
      orders (
        status,
        total,
        created_at,
        addresses ( address_text ),
        order_items ( product_name, quantity, restaurant_name )
      )
    `
    )
    .eq('delivery_person_id', profileId)
    .order('accepted_at', { ascending: false })
    .range(pagination.start, pagination.end - 1)

  if (error) {
    return (
      <Card>
        <CardContent>
          <p className="py-8 text-center text-sm text-destructive">
            No se pudo cargar tu historial de entregas.
          </p>
        </CardContent>
      </Card>
    )
  }

  const rows = ((deliveries ?? []) as unknown as DeliveryRow[]).map((d) => {
    const order = d.orders
    const restaurantName = order?.order_items?.[0]?.restaurant_name ?? '—'
    const itemsSummary =
      order?.order_items
        ?.map((i) => `${i.quantity}x ${i.product_name ?? 'Producto'}`)
        .join(', ') || '—'

    return {
      id: d.id,
      acceptedAt: d.accepted_at,
      deliveredAt: d.delivered_at,
      status: order?.status ?? 'CANCELLED',
      total: order?.total ?? 0,
      addressText: order?.addresses?.address_text ?? '—',
      restaurantName,
      itemsSummary,
      items:
        order?.order_items?.map((i) => ({
          productName: i.product_name ?? null,
          quantity: i.quantity,
        })) ?? [],
    }
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Historial de entregas</CardTitle>
      </CardHeader>
      <CardContent>
        {total > 0 ? (
          <>
            <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10 text-right">Nº</TableHead>
                <TableHead>Restaurante</TableHead>
                <TableHead>Productos</TableHead>
                <TableHead>Dirección</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, index) => (
                <TableRow key={row.id}>
                  <TableCell className="w-10 text-right text-muted-foreground tabular-nums">
                    {pagination.start + index + 1}
                  </TableCell>
                  <TableCell className="font-medium">{row.restaurantName}</TableCell>
                  <TableCell className="max-w-[220px] truncate text-muted-foreground">
                    {row.itemsSummary}
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate text-muted-foreground">
                    {row.addressText}
                  </TableCell>
                  <TableCell>
                    <OrderStatusBadge status={row.status} />
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    S/ {Number(row.total).toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right">
                    <DeliveryDetailsDialog
                      delivery={{
                        id: row.id,
                        restaurantName: row.restaurantName,
                        items: row.items,
                        addressText: row.addressText,
                        status: row.status,
                        total: row.total,
                        acceptedAt: row.acceptedAt,
                        deliveredAt: row.deliveredAt,
                      }}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
            <TablePagination
              basePath="/repartidor/historial"
              page={pagination.page}
              pageCount={pagination.pageCount}
            />
          </>
        ) : (
          <div className="flex h-40 flex-col items-center justify-center gap-2 text-center">
            <PackageIcon className="h-8 w-8 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              Todavía no tienes entregas en tu historial.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}