import { createClient } from '@/lib/db/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Package, Tags, ShoppingBag, Clock } from 'lucide-react'

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

  const cards = [
    {
      title: 'Total productos',
      value: totalProducts ?? 0,
      icon: Package,
      description: `${availableProducts ?? 0} disponibles`,
    },
    {
      title: 'Categorías',
      value: totalCategories ?? 0,
      icon: Tags,
      description: 'Organiza tu menú',
    },
    {
      title: 'Pedidos esta semana',
      value: ordersThisWeek ?? 0,
      icon: ShoppingBag,
      description: 'Con tus productos',
    },
    {
      title: 'Disponibilidad',
      value: `${totalProducts ? Math.round(((availableProducts ?? 0) / totalProducts) * 100) : 0}%`,
      icon: Clock,
      description: 'Productos activos',
    },
  ]

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.title}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {card.title}
            </CardTitle>
            <card.icon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{card.value}</div>
            <p className="text-xs text-muted-foreground">{card.description}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function getWeekStart(): string {
  const now = new Date()
  const day = now.getDay()
  const diff = now.getDate() - day + (day === 0 ? -6 : 1)
  const monday = new Date(now.setDate(diff))
  return monday.toISOString().split('T')[0]
}
