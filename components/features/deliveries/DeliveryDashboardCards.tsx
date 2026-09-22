'use client'

import useSWR from 'swr'
import { createClient } from '@/lib/db/client'
import { useRealtimeInvalidate } from '@/lib/hooks/use-realtime-invalidate'
import { StatCardGrid, type StatCardData } from '@/components/features/dashboard/StatCard'
import { MapPinIcon, PackageIcon, CheckCircle2Icon, HistoryIcon } from 'lucide-react'

interface DeliveryStats {
  availableOrders: number
  activeDeliveries: number
  deliveredToday: number
  deliveredTotal: number
}

async function fetchDeliveryStats(): Promise<DeliveryStats> {
  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('auth_id', user?.id ?? '')
    .maybeSingle()

  const profileId = profile?.id

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
      .eq('delivery_person_id', profileId ?? '')
      .is('delivered_at', null),
    supabase
      .from('deliveries')
      .select('*', { count: 'exact', head: true })
      .eq('delivery_person_id', profileId ?? '')
      .gte('delivered_at', todayStart.toISOString()),
    supabase
      .from('deliveries')
      .select('*', { count: 'exact', head: true })
      .eq('delivery_person_id', profileId ?? '')
      .not('delivered_at', 'is', null),
  ])

  return {
    availableOrders: availableOrders ?? 0,
    activeDeliveries: activeDeliveries ?? 0,
    deliveredToday: deliveredToday ?? 0,
    deliveredTotal: deliveredTotal ?? 0,
  }
}

export function DeliveryDashboardCards() {
  const { data, mutate } = useSWR<DeliveryStats>('delivery-dashboard-stats', fetchDeliveryStats, {
    revalidateOnFocus: true,
  })

  useRealtimeInvalidate(
    { channelName: 'delivery-dashboard-orders', table: 'orders', event: '*' },
    () => mutate()
  )
  useRealtimeInvalidate(
    { channelName: 'delivery-dashboard-deliveries', table: 'deliveries', event: '*' },
    () => mutate()
  )

  const cards: StatCardData[] = [
    {
      title: 'Pedidos disponibles',
      value: data?.availableOrders ?? 0,
      icon: MapPinIcon,
      description: 'Esperando repartidor',
    },
    {
      title: 'Entregas activas',
      value: data?.activeDeliveries ?? 0,
      icon: PackageIcon,
      description: 'Asignadas a ti',
    },
    {
      title: 'Entregadas hoy',
      value: data?.deliveredToday ?? 0,
      icon: CheckCircle2Icon,
      description: 'Completadas hoy',
    },
    {
      title: 'Total entregadas',
      value: data?.deliveredTotal ?? 0,
      icon: HistoryIcon,
      description: 'Historial completo',
    },
  ]

  return <StatCardGrid cards={cards} />
}