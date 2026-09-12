import { createClient } from '@/lib/db/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Users, Store, Truck, ShoppingBag } from 'lucide-react'

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

  const cards = [
    {
      title: 'Total usuarios',
      value: totalUsers ?? 0,
      icon: Users,
      description: 'Todos los roles',
    },
    {
      title: 'Restaurantes pendientes',
      value: pendingRestaurants ?? 0,
      icon: Store,
      description: `${activeRestaurants ?? 0} activos`,
    },
    {
      title: 'Repartidores pendientes',
      value: pendingDelivery ?? 0,
      icon: Truck,
      description: `${activeDelivery ?? 0} activos`,
    },
    {
      title: 'Pedidos hoy',
      value: ordersToday ?? 0,
      icon: ShoppingBag,
      description: new Date().toLocaleDateString('es-PE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
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
