import { createClient } from '@/lib/db/server'
import { DashboardCards } from '@/components/features/admin/DashboardCards'
import { OrdersByStatusChartClient } from '@/components/features/admin/OrdersByStatusChart'
import { RecentOrdersTable } from '@/components/features/admin/RecentOrdersTable'

export default async function AdminHomePage() {
  const supabase = await createClient()

  const { data: orders } = await supabase.from('orders').select('status')

  const statusCounts = (orders ?? []).reduce(
    (acc, order) => {
      acc[order.status] = (acc[order.status] ?? 0) + 1
      return acc
    },
    {} as Record<string, number>
  )

  const chartData = Object.entries(statusCounts).map(([status, total]) => ({
    status,
    total,
  }))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Panel de administración
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Aprueba negocios y repartidores, y supervisa la plataforma.
        </p>
      </div>

      <DashboardCards />

      <div className="grid gap-6 lg:grid-cols-2">
        <OrdersByStatusChartClient data={chartData} />
        <RecentOrdersTable />
      </div>
    </div>
  )
}
