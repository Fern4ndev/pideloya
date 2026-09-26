import { createClient } from '@/lib/db/server'
import { RestaurantDashboardCards } from '@/components/features/restaurants/RestaurantDashboardCards'
import {
  RestaurantDashboardCharts,
  type DashboardOrderItem,
} from '@/components/features/restaurants/RestaurantDashboardCharts'
import { PageHeader } from '@/components/layout/PageHeader'
import { PageContainer } from '@/components/layout/PageContainer'
import { RealtimeRefresh } from '@/components/ui/realtime-refresh'
import { RANGE_MAX_DAYS, addDays, limaDayKey } from '@/lib/dates'

/**
 * Tope de filas del payload. El dashboard trae hasta `RANGE_MAX_DAYS` (366) de
 * historial y filtra/agrega en el cliente — el mismo modelo que /admin. Con
 * `.order('created_at', desc)` el tope recorta lo más viejo, nunca lo reciente.
 */
const ORDER_ITEMS_LIMIT = 5000

export default async function RestauranteHomePage() {
  const supabase = await createClient()

  // Snapshot del "hoy" en Lima: se calcula en el servidor y viaja dentro del
  // HTML. Así el componente cliente no recalcula Date.now() al hidratar y no
  // hay hydration mismatch por fecha (ver lib/dates.ts).
  const todayKey = limaDayKey(new Date())

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('auth_id', user!.id)
    .single()

  const { data: member } = await supabase
    .from('restaurant_members')
    .select('restaurant_id')
    .eq('user_id', profile!.id)
    .single()

  const restaurantId = member?.restaurant_id ?? null

  // Una sola query con el rango máximo: el filtro por fecha exacta y la
  // granularidad (día/semana/mes) se resuelven en el cliente, igual que en
  // /admin. Filtramos explícitamente por restaurant_id además de la policy
  // "order_items_select_restaurant" (defensa en profundidad).
  const since = new Date(`${addDays(todayKey, -RANGE_MAX_DAYS)}T00:00:00-05:00`).toISOString()

  const orderItems: DashboardOrderItem[] = restaurantId
    ? (((
        await supabase
          .from('order_items')
          .select('order_id, product_name, quantity, unit_price, created_at')
          .eq('restaurant_id', restaurantId)
          .gte('created_at', since)
          .order('created_at', { ascending: false })
          .limit(ORDER_ITEMS_LIMIT)
      ).data ?? []) as DashboardOrderItem[])
    : []

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
        <RestaurantDashboardCharts orderItems={orderItems} todayKey={todayKey} />
      </div>
    </PageContainer>
  )
}