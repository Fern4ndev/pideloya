import { createClient } from '@/lib/db/server'
import { limaDayKey } from '@/lib/dates'
import { DashboardCards } from '@/components/features/admin/DashboardCards'
import { AdminDashboardCharts } from '@/components/features/admin/AdminDashboardCharts'
import { RecentOrdersTable } from '@/components/features/admin/RecentOrdersTable'
import { PageHeader } from '@/components/layout/PageHeader'
import { PageContainer } from '@/components/layout/PageContainer'
import { RealtimeRefresh } from '@/components/ui/realtime-refresh'

export default async function AdminHomePage() {
  const supabase = await createClient()

  // Snapshot del "hoy" en Lima: se calcula en el servidor y viaja dentro del
  // HTML. Así el componente cliente no recalcula new Date() al hidratar y no
  // hay hydration mismatch por fecha (ver lib/dates.ts).
  const todayKey = limaDayKey(new Date())

  const [
    { data: orders },
    { data: orderItems },
    { data: restaurants },
    { data: deliveries },
  ] = await Promise.all([
    supabase
      .from('orders')
      .select('id, status, total, created_at'),
    supabase
      .from('order_items')
      .select('order_id, restaurant_id'),
    supabase
      .from('restaurants')
      .select('id, name')
      .eq('is_approved', true)
      .order('name', { ascending: true }),
    supabase
      .from('deliveries')
      .select('order_id, delivery_person_id'),
  ])

  const deliveryPersonIds = [
    ...new Set(
      (deliveries ?? [])
        .map((delivery) => delivery.delivery_person_id)
        .filter((id): id is string => Boolean(id))
    ),
  ]

  const { data: deliveryPersons } =
    deliveryPersonIds.length > 0
      ? await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', deliveryPersonIds)
          .order('full_name', { ascending: true })
      : { data: [] }

  return (
    <PageContainer size="full">
      {/* KPIs, gráficos y pedidos recientes se actualizan solos con cada cambio en orders */}
      <RealtimeRefresh channelName="admin-orders" table="orders" />

      <PageHeader
        title="Panel de administración"
        description="Aprueba negocios y repartidores, y supervisa la plataforma."
      />

      <div className="mt-6 space-y-6">
        <DashboardCards />

        <AdminDashboardCharts
          orders={orders ?? []}
          orderItems={orderItems ?? []}
          restaurants={restaurants ?? []}
          deliveries={deliveries ?? []}
          deliveryPersons={deliveryPersons ?? []}
          todayKey={todayKey}
        />

        <RecentOrdersTable />
      </div>
    </PageContainer>
  )
}
