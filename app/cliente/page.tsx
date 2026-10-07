import { createClient } from '@/lib/db/server'
import { isRestaurantOpenNow } from '@/lib/restaurants/is-open'
import { StoreIcon } from 'lucide-react'
import { ClienteHomeClient } from '@/components/features/cliente-home/ClienteHomeClient'
import { EmptyState } from '@/components/ui/empty-state'
import type { RestaurantCardData } from '@/components/features/restaurants/RestaurantCard'
import type { FeaturedProduct } from '@/components/features/products/FeaturedProductCard'

export default async function ClienteHomePage() {
  const supabase = await createClient()

  // La policy RLS "restaurants_select_public" ya filtra por
  // is_approved = true e is_active = true — no hace falta repetirlo aquí.
  const { data: restaurants, error } = await supabase
    .from('restaurants')
    .select(
      'id, slug, name, description, logo_url, cover_url, address_text, food_type, is_open'
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
    cover_url: r.cover_url,
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

      {!error && restaurants && restaurants.length === 0 && (
        <EmptyState
          icon={StoreIcon}
          title="Todavía no hay negocios publicados"
          description="En cuanto el administrador apruebe el primer negocio en Abancay, va a aparecer aquí."
          className="mt-10 rounded-3xl"
        />
      )}

      {!error && restaurants && restaurants.length > 0 && (
        <ClienteHomeClient
          greeting={limaGreeting()}
          restaurants={listedRestaurants}
          popularProducts={popularProducts}
          closedRestaurantIds={closedRestaurantIds}
        />
      )}
    </div>
  )
}

/**
 * Saludo según la hora en Lima. Se calcula en el SERVIDOR (este page es un
 * Server Component) y viaja como prop: si se calculara en el cliente, el HTML
 * del snapshot y el primer render del browser podrían caer en franjas
 * distintas y React marcaría hydration mismatch — mismo motivo por el que
 * `limaDayKey`/`dayParts` viven en `lib/dates.ts` y se pasan como prop.
 *
 * Se formatea en `en-US` a propósito: `hour: 'numeric'` + `hour12: false`
 * devuelve el número pelado ("14"), sin el sufijo que agregan otros locales y
 * que rompería el `Number()`.
 */
function limaGreeting(): string {
  const hour = Number(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Lima',
      hour: 'numeric',
      hour12: false,
    }).format(new Date())
  )

  if (hour < 12) return 'Buenos días'
  if (hour < 19) return 'Buenas tardes'
  return 'Buenas noches'
}