import { createClient } from '@/lib/db/server'
import type { OrderStatus } from '@/lib/constants/order-status'
import type { OrderDetail } from '@/components/features/orders/OrderDetailsDialog'
import { RestaurantOrdersTable } from '@/components/features/restaurants/RestaurantOrdersTable'
import { PageHeader } from '@/components/layout/PageHeader'
import { PageContainer } from '@/components/layout/PageContainer'
import { TablePagination } from '@/components/ui/table-pagination'
import { TableShell } from '@/components/ui/table-shell'
import { EmptyState } from '@/components/ui/empty-state'
import { RealtimeRefresh } from '@/components/ui/realtime-refresh'
import { ClipboardListIcon } from 'lucide-react'
import { getPagination } from '@/lib/pagination'

export default async function RestaurantOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>
}) {
  const supabase = await createClient()
  const { page } = await searchParams

  const getCount = supabase
    .from('orders')
    .select('id', { count: 'exact', head: true })

  const total = (await getCount).count ?? 0
  const pagination = getPagination(total, page)

  const { data: orders, error } = await supabase
    .from('orders')
    .select(`
      id,
      status,
      total,
      created_at,
      order_items (
        product_name,
        quantity,
        unit_price
      )
    `)
    .order('created_at', { ascending: false })
    .range(pagination.start, pagination.end - 1)

  const rows: OrderDetail[] =
    orders?.map((order) => {
      const items =
        (order.order_items as unknown as
          | { product_name: string | null; quantity: number; unit_price: number }[]
          | null) ?? []

      return {
        id: order.id,
        status: order.status as OrderStatus,
        total: Number(order.total),
        createdAt: order.created_at,
        items: items.map((i) => ({
          productName: i.product_name,
          quantity: i.quantity,
          unitPrice: Number(i.unit_price),
        })),
      }
    }) ?? []

  return (
    <PageContainer size="full">
      {/* La tabla de pedidos se actualiza sola con cada cambio en orders */}
      <RealtimeRefresh channelName="restaurant-orders" table="orders" />

      <PageHeader
        title="Pedidos"
        description="Historial de pedidos que incluyen tus productos."
      />

      {error && (
        <p role="alert" className="mt-6 text-sm text-destructive">
          No se pudo cargar tus pedidos.
        </p>
      )}

      {!error && total > 0 && (
        <TableShell className="mt-6">
          <RestaurantOrdersTable orders={rows} startIndex={pagination.start} />
        </TableShell>
      )}

      {!error && total > 0 && (
        <TablePagination
          alwaysShow
          basePath="/restaurante/pedidos"
          page={pagination.page}
          pageCount={pagination.pageCount}
        />
      )}

      {!error && total === 0 && (
        <EmptyState
          icon={ClipboardListIcon}
          title="Aún no tienes pedidos"
          description="Cuando tus clientes compren, los pedidos aparecerán aquí."
          className="mt-10"
        />
      )}
    </PageContainer>
  )
}
