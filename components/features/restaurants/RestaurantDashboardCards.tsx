import { createClient } from '@/lib/db/server'
import { StatCardGrid, type StatCardData } from '@/components/features/dashboard/StatCard'
import { PackageIcon, TagsIcon, ShoppingBagIcon, ClockIcon } from 'lucide-react'

export async function RestaurantDashboardCards() {
  const supabase = await createClient()

  // Los 4 conteos en UNA consulta: restaurant_stats() (migración
  // 20261003120600, SECURITY INVOKER — la RLS sigue aplicando y resuelve el
  // restaurante del usuario con current_restaurant_ids()). Antes era la
  // cadena getUser + profiles + members y 4 counts 'exact' en Promise.all.
  // "Esta semana" = lunes 00:00 de Lima, la MISMA definición que el
  // weekStartIso() que vivía aquí (ahora en SQL, sin reloj del servidor).
  const { data, error } = await supabase.rpc('restaurant_stats')
  if (error) throw new Error(error.message)

  const stats = data?.[0]
  if (!stats) return null

  const totalProducts = Number(stats.total_products)
  const availableProducts = Number(stats.available_products)
  const totalCategories = Number(stats.total_categories)
  const ordersThisWeek = Number(stats.orders_this_week)

  const availabilityRate = totalProducts
    ? Math.round((availableProducts / totalProducts) * 100)
    : 0

  const cards: StatCardData[] = [
    {
      title: 'Total productos',
      value: totalProducts,
      icon: PackageIcon,
      description: `${availableProducts} disponibles`,
    },
    {
      title: 'Categorías',
      value: totalCategories,
      icon: TagsIcon,
      description: 'Organiza tu menú',
      tone: totalCategories === 0 ? 'warning' : 'default',
    },
    {
      title: 'Pedidos esta semana',
      value: ordersThisWeek,
      icon: ShoppingBagIcon,
      description: 'Con tus productos',
    },
    {
      title: 'Disponibilidad',
      value: `${availabilityRate}%`,
      icon: ClockIcon,
      description: 'Productos activos',
      tone: totalProducts > 0 && availabilityRate < 50 ? 'warning' : 'default',
    },
  ]

  return <StatCardGrid cards={cards} />
}