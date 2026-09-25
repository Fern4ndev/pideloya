import { createClient } from '@/lib/db/server'
import { StatCardGrid, type StatCardData } from '@/components/features/dashboard/StatCard'
import { UsersIcon, StoreIcon, TruckIcon, ShoppingBagIcon } from 'lucide-react'

export async function DashboardCards() {
  const supabase = await createClient()

  const [
    { count: totalUsers },
    { count: pendingRestaurants },
    { count: pendingDelivery },
    { count: ordersToday },
    { count: activeRestaurants },
    { count: activeDelivery },
  ] = await Promise.all([
    supabase.from('profiles').select('*', { count: 'exact', head: true }),
    supabase.from('restaurants').select('*', { count: 'exact', head: true }).eq('is_approved', false),
    supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'DELIVERY').eq('is_active', false),
    supabase.from('orders').select('*', { count: 'exact', head: true }).gte('created_at', new Date().toISOString().split('T')[0]),
    supabase.from('restaurants').select('*', { count: 'exact', head: true }).eq('is_approved', true),
    supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'DELIVERY').eq('is_active', true),
  ])

  const cards: StatCardData[] = [
    {
      title: 'Total usuarios',
      value: totalUsers ?? 0,
      icon: UsersIcon,
      description: 'Todos los roles',
    },
    {
      title: 'Restaurantes activos',
      value: activeRestaurants ?? 0,
      icon: StoreIcon,
      description: `${pendingRestaurants ?? 0} pendientes`,
      tone: (pendingRestaurants ?? 0) > 0 ? 'warning' : 'default',
    },
    {
      title: 'Repartidores activos',
      value: activeDelivery ?? 0,
      icon: TruckIcon,
      description: `${pendingDelivery ?? 0} pendientes`,
      tone: (pendingDelivery ?? 0) > 0 ? 'warning' : 'default',
    },
    {
      title: 'Pedidos hoy',
      value: ordersToday ?? 0,
      icon: ShoppingBagIcon,
      description: new Date().toLocaleDateString('es-PE', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }),
    },
  ]

  return <StatCardGrid cards={cards} />
}