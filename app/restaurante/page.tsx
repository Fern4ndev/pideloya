import { RestaurantDashboardCards } from '@/components/features/restaurants/RestaurantDashboardCards'
import { RestaurantRecentOrders } from '@/components/features/restaurants/RestaurantRecentOrders'
import { PageHeader } from '@/components/layout/PageHeader'
import { PageContainer } from '@/components/layout/PageContainer'

export default function RestauranteHomePage() {
  return (
    <PageContainer size="lg">
      <PageHeader
        title="Tu negocio en PideloYa"
        description="Resumen de tu restaurante. Los pedidos los gestiona directamente el flujo de reparto — no necesitas aceptarlos aquí."
      />

      <div className="mt-6 space-y-6">
        <RestaurantDashboardCards />
        <RestaurantRecentOrders />
      </div>
    </PageContainer>
  )
}