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

  // Los 4 conteos en UNA consulta: delivery_stats() (migración 20261003120600,
  // SECURITY INVOKER). Antes: getUser + profiles y 4 counts 'exact' en
  // Promise.all — y "entregadas hoy" usaba la medianoche del RELOJ DEL
  // NAVEGADOR (setHours(0,0,0,0) local): un repartidor con el celular en otra
  // zona horaria veía el conteo de "hoy" equivocado. La RPC ancla "hoy" a
  // Lima siempre.
  const { data, error } = await supabase.rpc('delivery_stats')
  if (error) throw new Error(error.message)

  const stats = data?.[0]

  return {
    availableOrders: Number(stats?.available_orders ?? 0),
    activeDeliveries: Number(stats?.active_deliveries ?? 0),
    deliveredToday: Number(stats?.delivered_today ?? 0),
    deliveredTotal: Number(stats?.delivered_total ?? 0),
  }
}

export function DeliveryDashboardCards() {
  const { data, mutate } = useSWR<DeliveryStats>('delivery-dashboard-stats', fetchDeliveryStats, {
    // Fase 2 (anti-churn de consultas): el foco de la pestaña ya NO dispara
    // consulta. El realtime de abajo invalida al detectar cambios reales en
    // orders/deliveries — esa es la señal que importa, no el alt-tab.
    revalidateOnFocus: false,
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