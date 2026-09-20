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
    .select('id, name, description, logo_url, address_text, whatsapp, food_type')
    .eq('slug', slug)
    .eq('is_approved', true)
    .eq('is_active', true)
    .maybeSingle()

  if (!restaurant) notFound()

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
    <RestaurantMenuView restaurant={restaurant} products={products ?? []} categories={categories ?? []} />
  )
}