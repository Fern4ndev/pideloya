import { createClient } from '@/lib/db/server'
import { isRestaurantOpenNow } from '@/lib/restaurants/is-open'
import { ClienteHomeClient } from '@/components/features/cliente-home/ClienteHomeClient'
import type { RestaurantCardData } from '@/components/features/restaurants/RestaurantCard'
import type { FeaturedProduct } from '@/components/features/products/FeaturedProductCard'

export default async function ClienteHomePage() {
  const supabase = await createClient()

  // La policy RLS "restaurants_select_public" ya filtra por
  // is_approved = true e is_active = true — no hace falta repetirlo aquí.
  const { data: restaurants, error } = await supabase
    .from('restaurants')
    .select(
      'id, slug, name, description, logo_url, address_text, food_type, is_open'
    )
    .order('name')

  // Horarios de los negocios visibles para saber si están atendiendo ahora
  // (policy "restaurant_hours_select_public", migración 20260924000000).
  const restaurantIds = (restaurants ?? []).map((r) => r.id)
  const { data: hours } = restaurantIds.length
    ? await supabase
        .from('restaurant_hours')
        .select('restaurant_id, day_of_week, open_time, close_time, is_closed')
        .in('restaurant_id', restaurantIds)
    : { data: [] }

  const openByRestaurantId = new Map<string, boolean>()
  for (const r of restaurants ?? []) {
    const restaurantHours = (hours ?? []).filter((h) => h.restaurant_id === r.id)
    openByRestaurantId.set(r.id, isRestaurantOpenNow(r.is_open, restaurantHours))
  }

  const listedRestaurants: RestaurantCardData[] = (restaurants ?? []).map((r) => ({
    slug: r.slug,
    name: r.name,
    description: r.description,
    logo_url: r.logo_url,
    address_text: r.address_text,
    food_type: r.food_type,
    isOpen: openByRestaurantId.get(r.id) ?? true,
  }))

  const closedRestaurantIds = (restaurants ?? [])
    .filter((r) => !(openByRestaurantId.get(r.id) ?? true))
    .map((r) => r.id)

  // "Platos populares": últimos productos disponibles, con el restaurante
  // embebido para poder agregarlos al carrito directo desde la home.
  // Requiere las policies "products_select_customer" /
  // "categories_select_customer" — ver migración 20260920100000.
  const { data: popularProductsRaw } = await supabase
    .from('products')
    .select('id, name, price, image_url, restaurants(id, name)')
    .eq('available', true)
    .order('created_at', { ascending: false })
    .limit(12)

  const popularProducts: FeaturedProduct[] = (popularProductsRaw ?? [])
    .filter((p) => p.restaurants)
    .map((p) => {
      const restaurant = p.restaurants as unknown as { id: string; name: string }
      return {
        id: p.id,
        name: p.name,
        price: Number(p.price),
        imageUrl: p.image_url,
        restaurant: { id: restaurant.id, name: restaurant.name },
      }
    })

  return (
    <div>
      {error && (
        <p className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
          No pudimos cargar los negocios. Intenta recargar la página.
        </p>
      )}

      {!error && restaurants && restaurants.length === 0 && <EmptyState />}

      {!error && restaurants && restaurants.length > 0 && (
        <ClienteHomeClient
          restaurants={listedRestaurants}
          popularProducts={popularProducts}
          closedRestaurantIds={closedRestaurantIds}
        />
      )}
    </div>
  )
}

function EmptyState() {
  return (
    <div className="mt-10 flex flex-col items-center rounded-xl border border-dashed px-6 py-14 text-center">
      <p className="font-medium">Todavía no hay negocios publicados</p>
      <p className="mt-1 max-w-xs text-sm text-muted-foreground">
        En cuanto el administrador apruebe el primer negocio en Abancay, va a
        aparecer aquí.
      </p>
    </div>
  )
}