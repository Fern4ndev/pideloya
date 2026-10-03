import { createServerClient } from '@supabase/ssr'
import { revalidateTag, unstable_cache } from 'next/cache'
import type { Database } from '@/types/database'

/**
 * Cliente de Supabase SIN sesión (rol anon) para páginas públicas
 * ((public)/restaurantes, menú por slug).
 *
 * No lee ni escribe cookies: la consulta es idéntica para todos los
 * visitantes, así que el resultado se cachea con `unstable_cache` y se
 * invalida on-demand con `revalidateTag('restaurants', 'max')` desde las
 * actions que mutan restaurantes/productos/categorías/horarios.
 *
 * ⚠️ Nunca uses este cliente para datos de usuario: RLS vería todo el
 * mundo como anon. Es solo para contenido público aprobado.
 *
 * OJO: `unstable_cache` NO puede leer cookies/headers dentro del fn
 * cacheado — por eso este cliente no las toca.
 */
export function createPublicClient() {
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return []
        },
        setAll() {
          // Cliente público: no maneja sesión.
        },
      },
    },
  )
}

/**
 * Tag único de caché de las páginas públicas de restaurantes.
 * Toda mutación que afecte el listado o el menú debe llamar
 * `revalidateTag(PUBLIC_RESTAURANTS_TAG, 'max')` (Next 16: la firma de un
 * argumento está deprecada).
 */
export const PUBLIC_RESTAURANTS_TAG = 'restaurants'

/**
 * Red de seguridad además del revalidateTag: si alguna mutación se cuela
 * sin invalidar (p. ej. un script directo), el listado/menú se refresca
 * igual en 5 minutos.
 */
const PUBLIC_REVALIDATE_SECONDS = 300

/**
 * Invalida la caché pública de restaurantes/menú. Llamar DESPUÉS de cada
 * mutación exitosa (Server Actions): Next 16 exige la firma de dos
 * argumentos; `'max'` marca la entrada como stale y la siguiente visita
 * refresca en background (stale-while-revalidate) sin bloquear.
 */
export function revalidatePublicRestaurants() {
  revalidateTag(PUBLIC_RESTAURANTS_TAG, 'max')
}

/** Listado público de restaurantes aprobados y activos (página /restaurantes). */
export const getPublicRestaurants = unstable_cache(
  async () => {
    const supabase = createPublicClient()
    const { data, error } = await supabase
      .from('restaurants')
      .select('slug, name, description, logo_url, address_text, food_type, is_open')
      .eq('is_approved', true)
      .eq('is_active', true)
      .order('name', { ascending: true })

    // En error se devuelve null y la página muestra su mensaje de fallback;
    // no se cachea el fallo como lista vacía.
    if (error) return null
    return data
  },
  ['public-restaurants'],
  {
    tags: [PUBLIC_RESTAURANTS_TAG],
    revalidate: PUBLIC_REVALIDATE_SECONDS,
  },
)

export interface PublicRestaurantMenu {
  restaurant: {
    id: string
    name: string
    description: string | null
    logo_url: string | null
    address_text: string | null
    whatsapp: string | null
    food_type: string | null
    is_open: boolean
  }
  hours: {
    day_of_week: number
    open_time: string
    close_time: string
    is_closed: boolean
  }[]
  products: {
    id: string
    name: string
    description: string | null
    price: number
    image_url: string | null
    category_id: string | null
  }[]
  categories: { id: string; name: string }[]
}

/**
 * Menú público de un restaurante por slug (página /[slug]).
 * Devuelve null si el restaurante no existe / no está visible — la página
 * llama a `notFound()` en ese caso, igual que antes.
 */
export const getPublicRestaurantMenu = unstable_cache(
  async (slug: string): Promise<PublicRestaurantMenu | null> => {
    const supabase = createPublicClient()

    const { data: restaurant } = await supabase
      .from('restaurants')
      .select(
        'id, name, description, logo_url, address_text, whatsapp, food_type, is_open',
      )
      .eq('slug', slug)
      .eq('is_approved', true)
      .eq('is_active', true)
      .maybeSingle()

    if (!restaurant) return null

    const [hours, products, categories] = await Promise.all([
      supabase
        .from('restaurant_hours')
        .select('day_of_week, open_time, close_time, is_closed')
        .eq('restaurant_id', restaurant.id),
      supabase
        .from('products')
        .select('id, name, description, price, image_url, category_id')
        .eq('restaurant_id', restaurant.id)
        .eq('available', true)
        .order('created_at', { ascending: false }),
      supabase
        .from('categories')
        .select('id, name')
        .eq('restaurant_id', restaurant.id)
        .order('sort_order', { ascending: true }),
    ])

    return {
      restaurant,
      hours: hours.data ?? [],
      products: products.data ?? [],
      categories: categories.data ?? [],
    }
  },
  ['public-restaurant-menu'],
  {
    tags: [PUBLIC_RESTAURANTS_TAG],
    revalidate: PUBLIC_REVALIDATE_SECONDS,
  },
)
