import { createClient } from '@/lib/db/server'
import { StatCardGrid, type StatCardData } from '@/components/features/dashboard/StatCard'
import { PackageIcon, TagsIcon, ShoppingBagIcon, ClockIcon } from 'lucide-react'

async function getMyRestaurantId(supabase: Awaited<ReturnType<typeof createClient>>) {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('auth_id', user.id)
    .single()

  if (!profile) return null

  const { data: member } = await supabase
    .from('restaurant_members')
    .select('restaurant_id')
    .eq('user_id', profile.id)
    .single()

  return member?.restaurant_id as string | null
}

export async function RestaurantDashboardCards() {
  const supabase = await createClient()
  const restaurantId = await getMyRestaurantId(supabase)

  if (!restaurantId) return null

  const [
    { count: totalProducts },
    { count: availableProducts },
    { count: totalCategories },
    { count: ordersThisWeek },
  ] = await Promise.all([
    supabase
      .from('products')
      .select('*', { count: 'exact', head: true })
      .eq('restaurant_id', restaurantId),
    supabase
      .from('products')
      .select('*', { count: 'exact', head: true })
      .eq('restaurant_id', restaurantId)
      .eq('available', true),
    supabase
      .from('categories')
      .select('*', { count: 'exact', head: true })
      .eq('restaurant_id', restaurantId),
    supabase
      .from('order_items')
      .select('order_id', { count: 'exact', head: true })
      .eq('restaurant_id', restaurantId)
      .gte('created_at', getWeekStart()),
  ])

  const availabilityRate = totalProducts
    ? Math.round(((availableProducts ?? 0) / totalProducts) * 100)
    : 0

  const cards: StatCardData[] = [
    {
      title: 'Total productos',
      value: totalProducts ?? 0,
      icon: PackageIcon,
      description: `${availableProducts ?? 0} disponibles`,
    },
    {
      title: 'Categorías',
      value: totalCategories ?? 0,
      icon: TagsIcon,
      description: 'Organiza tu menú',
      tone: totalCategories === 0 ? 'warning' : 'default',
    },
    {
      title: 'Pedidos esta semana',
      value: ordersThisWeek ?? 0,
      icon: ShoppingBagIcon,
      description: 'Con tus productos',
    },
    {
      title: 'Disponibilidad',
      value: `${availabilityRate}%`,
      icon: ClockIcon,
      description: 'Productos activos',
      tone: totalProducts && availabilityRate < 50 ? 'warning' : 'default',
    },
  ]

  return <StatCardGrid cards={cards} />
}

function getWeekStart(): string {
  const now = new Date()
  const day = now.getDay()
  const diff = now.getDate() - day + (day === 0 ? -6 : 1)
  const monday = new Date(now.setDate(diff))
  return monday.toISOString().split('T')[0]
}