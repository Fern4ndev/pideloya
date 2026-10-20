import { createClient } from '@/lib/db/server'
import { DeliveryDashboardCards } from '@/components/features/deliveries/DeliveryDashboardCards'
import { DeliveryDashboardChartsLazy } from '@/components/features/deliveries/DeliveryDashboardChartsLazy'
import type { DashboardDelivery } from '@/components/features/deliveries/DeliveryDashboardCharts'
import { PageHeader } from '@/components/layout/PageHeader'
import { PageContainer } from '@/components/layout/PageContainer'
import { RANGE_MAX_DAYS, limaDayKey } from '@/lib/dates'

export default async function RepartidorHomePage() {
  const supabase = await createClient()

  // Snapshot del "hoy" en Lima: se calcula en el servidor y viaja dentro del
  // HTML. Así el componente cliente no recalcula new Date() al hidratar y no
  // hay hydration mismatch por fecha (ver lib/dates.ts).
  const todayKey = limaDayKey(new Date())

  // UNA consulta: delivery_chart_rows(p_days) (migración 20261003120600)
  // trae las entregas completadas del repartidor (delivered_at, delivery_fee
  // y el estado del pedido para descartar las no completadas), con tope
  // interno 20000 y json como transporte (NO pasa por max_rows de PostgREST,
  // que truncaba silenciosamente a 1000 filas). Antes: getUser + profiles +
  // 5000 filas con embed. La pertenencia la resuelve la RPC con
  // current_profile_id() (SECURITY INVOKER: RLS aplicando).
  //
  // `delivery_fee` es lo que el repartidor GANÓ por esa entrega; `orders.total`
  // es el precio de la comida, que nunca fue suyo (ver la corrección en
  // DeliveryDashboardCharts).
  const { data: rows, error } = await supabase.rpc('delivery_chart_rows', {
    p_days: RANGE_MAX_DAYS,
  })
  if (error) throw new Error(error.message)

  const deliveries: DashboardDelivery[] = (rows ?? []).map((row) => ({
    delivered_at: row.delivered_at,
    delivery_fee: row.delivery_fee,
    orders: { status: row.status ?? '' },
  }))

  return (
    // "full" como /admin y /restaurante: los gráficos a dos columnas no deben
    // pelearse con un max-w-4xl heredado de "lg".
    <PageContainer size="full">
      <PageHeader
        title="Panel de reparto"
        description="Usa el menú de la izquierda para ir a Disponibles (ofertar por pedidos) o Mi entrega (la que tienes en curso)."
      />

      <div className="mt-6 space-y-6">
        <DeliveryDashboardCards />
        <DeliveryDashboardChartsLazy deliveries={deliveries} todayKey={todayKey} />
      </div>
    </PageContainer>
  )
}