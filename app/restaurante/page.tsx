import { RestaurantDashboardCards } from '@/components/features/restaurants/RestaurantDashboardCards'
import { RestaurantRecentOrders } from '@/components/features/restaurants/RestaurantRecentOrders'

export default function RestauranteHomePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Tu negocio en PideloYa
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Resumen de tu restaurante. Los pedidos los gestiona directamente el
          flujo de reparto — no necesitas aceptarlos aquí.
        </p>
      </div>
      <RestaurantDashboardCards />
      <RestaurantRecentOrders />
    </div>
  )
}
