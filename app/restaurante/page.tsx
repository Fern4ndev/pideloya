import { RestaurantDashboardCards } from '@/components/features/restaurants/RestaurantDashboardCards'
import { RestaurantDashboardCharts } from '@/components/features/restaurants/RestaurantDashboardCharts'
import { PageHeader } from '@/components/layout/PageHeader'
import { PageContainer } from '@/components/layout/PageContainer'
import { RealtimeRefresh } from '@/components/ui/realtime-refresh'
import { limaDayKey } from '@/lib/dates'

export default function RestauranteHomePage() {
  // Snapshot del "hoy" en Lima: se calcula en el servidor y viaja dentro del
  // HTML. Así el componente cliente no recalcula Date.now() al hidratar y no
  // hay hydration mismatch por fecha (ver lib/dates.ts).
  const todayKey = limaDayKey(new Date())

  return (
    <PageContainer size="full">
      {/* Los KPIs y gráficos se actualizan solos con cada cambio en orders */}
      <RealtimeRefresh channelName="restaurant-dashboard-orders" table="orders" />

      <PageHeader
        title="Tu negocio en PideloYa"
        description="Resumen de tu restaurante. Los pedidos los gestiona directamente el flujo de reparto — no necesitas aceptarlos aquí."
      />

      <div className="mt-6 space-y-6">
        <RestaurantDashboardCards />
        <RestaurantDashboardCharts todayKey={todayKey} />
      </div>
    </PageContainer>
  )
}