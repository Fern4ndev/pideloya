import { createClient } from '@/lib/db/server'
import { ClienteHomeClient } from '@/components/features/cliente-home/ClienteHomeClient'
import type { RestaurantCardData } from '@/components/features/restaurants/RestaurantCard'
import type { FeaturedProduct } from '@/components/features/products/FeaturedProductCard'

export default async function ClienteHomePage() {
  const supabase = await createClient()

  const [restaurantsResult, productsResult] = await Promise.all([
    supabase
      .from('restaurants')
      .select('slug, name, description, logo_url, address_text, food_type')
      .eq('is_approved', true)
      .eq('is_active', true)
      .order('name'),
    supabase
      .from('products')
      .select('id, name, price, image_url, restaurant:restaurants!inner(id, name, is_approved, is_active)')
      .eq('available', true)
      .eq('restaurant.is_approved', true)
      .eq('restaurant.is_active', true)
      .order('created_at', { ascending: false })
      .limit(12),
  ])

  const restaurants = (restaurantsResult.data ?? []) as RestaurantCardData[]
  const popularProducts = ((productsResult.data ?? []) as any[]).map((p) => ({
    id: p.id,
    name: p.name,
    price: Number(p.price),
    imageUrl: p.image_url,
    restaurant: { id: p.restaurant.id, name: p.restaurant.name },
  })) as FeaturedProduct[]

  return (
    <ClienteHomeClient
      restaurants={restaurants}
      popularProducts={popularProducts}
    />
  )
}
