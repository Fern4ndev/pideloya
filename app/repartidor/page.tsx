import { createClient } from '@/lib/db/server'
import { DeliveryDashboardCards } from '@/components/features/deliveries/DeliveryDashboardCards'
import {
  DeliveryDashboardCharts,
  type DashboardDelivery,
} from '@/components/features/deliveries/DeliveryDashboardCharts'
import { PageHeader } from '@/components/layout/PageHeader'
import { PageContainer } from '@/components/layout/PageContainer'
import { RANGE_MAX_DAYS, addDays, limaDayKey } from '@/lib/dates'

/**
 * Tope de filas del payload. El dashboard trae hasta `RANGE_MAX_DAYS` (366) de
 * entregas y filtra/agrega en el cliente, igual que /admin y /restaurante. Con
 * `.order('delivered_at', desc)` el tope recorta lo más viejo, nunca lo reciente.
 */
const DELIVERIES_LIMIT = 5000

export default async function RepartidorHomePage() {
  const supabase = await createClient()

  // Snapshot del "hoy" en Lima: se calcula en el servidor y viaja dentro del
  // HTML. Así el componente cliente no recalcula new Date() al hidratar y no
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

  const profileId = profile?.id ?? null

  // Ventana en medianoche de Lima, derivada de `todayKey` (no de Date.now():
  // la regla react-hooks/purity rechaza leer el reloj dentro del componente).
  // Solo entregas ya completadas dentro del rango: los gráficos son históricos.
  const since = new Date(`${addDays(todayKey, -RANGE_MAX_DAYS)}T00:00:00-05:00`).toISOString()

  const deliveries: DashboardDelivery[] = profileId
    ? ((await supabase
        .from('deliveries')
        .select('delivered_at, orders(status, total)')
        .eq('delivery_person_id', profileId)
        .gte('delivered_at', since)
        .order('delivered_at', { ascending: false })
        .limit(DELIVERIES_LIMIT)).data ?? [])
    : []

  return (
    // "full" como /admin y /restaurante: los gráficos a dos columnas no deben
    // pelearse con un max-w-4xl heredado de "lg".
    <PageContainer size="full">
      <PageHeader
        title="Panel de reparto"
        description="Usa el menú de la izquierda para ir a Disponibles (aceptar pedidos) o Mis entregas (los que ya tienes asignados)."
      />

      <div className="mt-6 space-y-6">
        <DeliveryDashboardCards />
        <DeliveryDashboardCharts deliveries={deliveries} todayKey={todayKey} />
      </div>
    </PageContainer>
  )
}