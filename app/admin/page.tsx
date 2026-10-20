import { createClient } from '@/lib/db/server'
import { limaDayKey, RANGE_MAX_DAYS } from '@/lib/dates'
import { DashboardCards } from '@/components/features/admin/DashboardCards'
import { AdminDashboardChartsLazy } from '@/components/features/admin/AdminDashboardChartsLazy'
import type { AdminDashboardData } from '@/components/features/admin/AdminDashboardCharts'
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

  // UNA consulta para todo el panel de gráficas: admin_dashboard(p_days)
  // (migración 20261003120600) pre-agrega ventas por día, por restaurante y
  // entregas por repartidor (zonas horarias de Lima resueltas en SQL), y
  // trae las opciones de los selects. Antes eran 5 consultas que traían
  // orders + order_items + deliveries SIN límite: PostgREST truncaba
  // silenciosamente a max_rows=1000 y las gráficas mentían al crecer (H4).
  const { data, error } = await supabase.rpc('admin_dashboard', {
    p_days: RANGE_MAX_DAYS,
  })
  if (error) throw new Error(error.message)

  const dashboard: AdminDashboardData = data ?? {
    restaurants: [],
    delivery_persons: [],
    sales_daily: [],
    sales_by_restaurant: [],
    delivered_by_person: [],
  }

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

        {/* Lazy (Fase 4): recharts entra en un chunk aparte con ssr:false */}
        <AdminDashboardChartsLazy data={dashboard} todayKey={todayKey} />

        <RecentOrdersTable />
      </div>
    </PageContainer>
  )
}
