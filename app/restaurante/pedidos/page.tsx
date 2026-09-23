import { createClient } from '@/lib/db/server'
import type { OrderStatus } from '@/lib/constants/order-status'
import type { OrderDetail } from '@/components/features/orders/OrderDetailsDialog'
import { RestaurantOrdersTable } from '@/components/features/restaurants/RestaurantOrdersTable'
import { PageHeader } from '@/components/layout/PageHeader'
import { PageContainer } from '@/components/layout/PageContainer'
import { TablePagination } from '@/components/ui/table-pagination'
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
      <PageHeader
        title="Pedidos"
        description="Historial de pedidos que incluyen tus productos."
      />

      {error && (
        <p className="mt-6 text-sm text-destructive">
          No se pudo cargar tus pedidos.
        </p>
      )}

      {!error && total > 0 && (
        <div className="mt-6 overflow-hidden rounded-2xl border">
          <RestaurantOrdersTable orders={rows} startIndex={pagination.start} />
        </div>
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
        <div className="mt-10 flex flex-col items-center rounded-xl border border-dashed px-6 py-14 text-center">
          <p className="font-medium">Aún no tienes pedidos</p>
          <p className="mt-1 max-w-xs text-sm text-muted-foreground">
            Cuando tus clientes compren, los pedidos aparecerán aquí.
          </p>
        </div>
      )}
    </PageContainer>
  )
}
