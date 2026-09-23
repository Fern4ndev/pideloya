import { createClient } from '@/lib/db/server'
import { DashboardCards } from '@/components/features/admin/DashboardCards'
import { AdminDashboardCharts } from '@/components/features/admin/AdminDashboardCharts'
import { RecentOrdersTable } from '@/components/features/admin/RecentOrdersTable'

export default async function AdminHomePage() {
  const supabase = await createClient()

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

      <AdminDashboardCharts
        orders={orders ?? []}
        orderItems={orderItems ?? []}
        restaurants={restaurants ?? []}
        deliveries={deliveries ?? []}
        deliveryPersons={deliveryPersons ?? []}
      />

      <RecentOrdersTable />
    </div>
  )
}
