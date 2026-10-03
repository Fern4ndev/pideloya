import { createClient } from '@/lib/db/server'
import { StatCardGrid, type StatCardData } from '@/components/features/dashboard/StatCard'
import { UsersIcon, StoreIcon, TruckIcon, ShoppingBagIcon } from 'lucide-react'

export async function DashboardCards() {
  const supabase = await createClient()

  // Los 6 conteos en UNA consulta: admin_counts() (migración 20261003120600,
  // SECURITY INVOKER). Antes eran 6 counts 'exact' en Promise.all, y "pedidos
  // hoy" se calculaba con una medianoche de Lima expresada a mano en TS.
  const { data, error } = await supabase.rpc('admin_counts')
  if (error) throw new Error(error.message)

  const counts = data ?? {
    total_users: 0,
    restaurants_pending: 0,
    restaurants_active: 0,
    deliveries_pending: 0,
    deliveries_active: 0,
    orders_today: 0,
    payment_incidents_open: 0,
  }

  const cards: StatCardData[] = [
    {
      title: 'Total usuarios',
      value: Number(counts.total_users),
      icon: UsersIcon,
      description: 'Todos los roles',
    },
    {
      title: 'Restaurantes activos',
      value: Number(counts.restaurants_active),
      icon: StoreIcon,
      description: `${counts.restaurants_pending} pendientes`,
      tone: counts.restaurants_pending > 0 ? 'warning' : 'default',
    },
    {
      title: 'Repartidores activos',
      value: Number(counts.deliveries_active),
      icon: TruckIcon,
      description: `${counts.deliveries_pending} pendientes`,
      tone: counts.deliveries_pending > 0 ? 'warning' : 'default',
    },
    {
      // Único acento de marca del dashboard: el pulso del día.
      title: 'Pedidos hoy',
      value: Number(counts.orders_today),
      icon: ShoppingBagIcon,
      description: new Date().toLocaleDateString('es-PE', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        timeZone: 'America/Lima',
      }),
      tone: 'accent',
    },
  ]

  return <StatCardGrid cards={cards} />
}