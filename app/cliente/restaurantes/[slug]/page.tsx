import { notFound } from 'next/navigation'
import { createClient } from '@/lib/db/server'
import { RestaurantMenuView } from '@/components/features/restaurants/RestaurantMenuView'

export default async function ClienteRestaurantMenuPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const supabase = await createClient()

  const { data: restaurant } = await supabase
    .from('restaurants')
    .select(
      'id, name, description, logo_url, address_text, whatsapp, food_type, is_open'
    )
    .eq('slug', slug)
    .eq('is_approved', true)
    .eq('is_active', true)
    .maybeSingle()

  if (!restaurant) notFound()

  // Horarios de atención (policy "restaurant_hours_select_public") para
  // avisar "Abierto/Cerrado" en vivo y deshabilitar los botones de pedido.
  const { data: hours } = await supabase
    .from('restaurant_hours')
    .select('day_of_week, open_time, close_time, is_closed')
    .eq('restaurant_id', restaurant.id)

  const { data: products } = await supabase
    .from('products')
    .select('id, name, description, price, image_url, category_id')
    .eq('restaurant_id', restaurant.id)
    .eq('available', true)
    .order('created_at', { ascending: false })

  const { data: categories } = await supabase
    .from('categories')
    .select('id, name')
    .eq('restaurant_id', restaurant.id)
    .order('sort_order', { ascending: true })

  return (
    <RestaurantMenuView
      restaurant={restaurant}
      products={products ?? []}
      categories={categories ?? []}
      hours={hours ?? []}
    />
  )
}