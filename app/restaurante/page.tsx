import { createClient } from '@/lib/db/server'
import { getMyRestaurantIdOrNull } from '@/lib/auth/session'
import { RestaurantDashboardCards } from '@/components/features/restaurants/RestaurantDashboardCards'
import { RestaurantDashboardChartsLazy } from '@/components/features/restaurants/RestaurantDashboardChartsLazy'
import type { DashboardOrderItem } from '@/components/features/restaurants/RestaurantDashboardCharts'
import { PageHeader } from '@/components/layout/PageHeader'
import { PageContainer } from '@/components/layout/PageContainer'
import { RealtimeRefresh } from '@/components/ui/realtime-refresh'
import { RANGE_MAX_DAYS, limaDayKey } from '@/lib/dates'

export default async function RestauranteHomePage() {
  const supabase = await createClient()

  // Snapshot del "hoy" en Lima: se calcula en el servidor y viaja dentro del
  // HTML. Así el componente cliente no recalcula Date.now() al hidratar y no
  // hay hydration mismatch por fecha (ver lib/dates.ts).
  const todayKey = limaDayKey(new Date())

  // Solo para el filtro de realtime (abajo): la cadena de identidad vive en
  // lib/auth/session.ts con cache() de React.
  const restaurantId = await getMyRestaurantIdOrNull()

  // UNA consulta: restaurant_chart_items(p_days) (migración 20261003120600)
  // trae las líneas de order_items del restaurante con tope interno 20000 y
  // json como transporte (NO pasa por max_rows de PostgREST, que truncaba
  // silenciosamente a 1000 filas y hacía mentir a las gráficas). El filtro
  // por fecha exacta y la granularidad (día/semana/mes) se resuelven en el
  // cliente, igual que en /admin. La pertenencia al restaurante la resuelve
  // la RPC con current_restaurant_ids() (SECURITY INVOKER: RLS aplicando).
  const { data: items, error } = await supabase.rpc('restaurant_chart_items', {
    p_days: RANGE_MAX_DAYS,
  })
  if (error) throw new Error(error.message)

  const orderItems: DashboardOrderItem[] = (items ?? []).map((item) => ({
    order_id: item.order_id,
    product_name: item.product_name,
    quantity: item.quantity,
    unit_price: item.unit_price,
    created_at: item.created_at,
  }))

  return (
    <PageContainer size="full">
      {/* Los KPIs y gráficos se actualizan solos. Suscribimos a order_items
          filtrado por restaurant_id — la fuente REAL de ambos: las gráficas
          se construyen con esas líneas y el conteo semanal las cuenta. La
          tabla ya está en la publication supabase_realtime (migración
          20261003120500) y el filtro evita refrescar por movimientos de
          OTROS restaurantes. Antes se suscribía a `orders` sin filtro: cada
          cambio de estado de cualquier pedido del sistema refrescaba este
          panel aunque nada suyo hubiera cambiado. */}
      {restaurantId && (
        <RealtimeRefresh
          channelName="restaurant-dashboard-items"
          table="order_items"
          filter={`restaurant_id=eq.${restaurantId}`}
        />
      )}

      <PageHeader
        title="Tu negocio en PideloYa"
        description="Resumen de tu restaurante. Los pedidos los gestiona directamente el flujo de reparto — no necesitas aceptarlos aquí."
      />

      <div className="mt-6 space-y-6">
        <RestaurantDashboardCards />
        <RestaurantDashboardChartsLazy orderItems={orderItems} todayKey={todayKey} />
      </div>
    </PageContainer>
  )
}