import { createClient } from '@/lib/db/server'
import { StatCardGrid, type StatCardData } from '@/components/features/dashboard/StatCard'
import { MapPinIcon, PackageIcon, CheckCircle2Icon, HistoryIcon } from 'lucide-react'

async function getMyProfileId(supabase: Awaited<ReturnType<typeof createClient>>) {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('auth_id', user.id)
    .single()

  return profile?.id as string | null
}

export async function DeliveryDashboardCards() {
  const supabase = await createClient()
  const profileId = await getMyProfileId(supabase)

  if (!profileId) return null

  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  const [
    { count: availableOrders },
    { count: activeDeliveries },
    { count: deliveredToday },
    { count: deliveredTotal },
  ] = await Promise.all([
    supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'PENDING'),
    supabase
      .from('deliveries')
      .select('*', { count: 'exact', head: true })
      .eq('delivery_person_id', profileId)
      .is('delivered_at', null),
    supabase
      .from('deliveries')
      .select('*', { count: 'exact', head: true })
      .eq('delivery_person_id', profileId)
      .gte('delivered_at', todayStart.toISOString()),
    supabase
      .from('deliveries')
      .select('*', { count: 'exact', head: true })
      .eq('delivery_person_id', profileId)
      .not('delivered_at', 'is', null),
  ])

  const cards: StatCardData[] = [
    {
      title: 'Pedidos disponibles',
      value: availableOrders ?? 0,
      icon: MapPinIcon,
      description: 'Esperando repartidor',
    },
    {
      title: 'Entregas activas',
      value: activeDeliveries ?? 0,
      icon: PackageIcon,
      description: 'Asignadas a ti',
    },
    {
      title: 'Entregadas hoy',
      value: deliveredToday ?? 0,
      icon: CheckCircle2Icon,
      description: 'Completadas hoy',
    },
    {
      title: 'Total entregadas',
      value: deliveredTotal ?? 0,
      icon: HistoryIcon,
      description: 'Historial completo',
    },
  ]

  return <StatCardGrid cards={cards} />
}