import { createClient } from '@/lib/db/server'
import { RestaurantCard } from '@/components/features/restaurants/RestaurantCard'

export const dynamic = 'force-dynamic'

export default async function RestaurantesPage() {
  const supabase = await createClient()

  const { data: restaurants, error } = await supabase
    .from('restaurants')
    .select('slug, name, description, logo_url, address_text, food_type, is_open')
    .eq('is_approved', true)
    .eq('is_active', true)
    .order('name', { ascending: true })

  return (
    <main className="mx-auto max-w-7xl px-6 py-12">
      <h1 className="text-3xl font-semibold tracking-tight">Restaurantes</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Explora todos los negocios disponibles en Abancay.
      </p>

      {error && (
        <p className="mt-8 text-sm text-destructive">
          No se pudo cargar la lista de restaurantes.
        </p>
      )}

      {!error && restaurants && restaurants.length > 0 && (
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {restaurants.map((r) => (
            <RestaurantCard
              key={r.slug}
              restaurant={{
                slug: r.slug,
                name: r.name,
                description: r.description,
                logo_url: r.logo_url,
                address_text: r.address_text,
                food_type: r.food_type,
                isOpen: r.is_open,
              }}
            />
          ))}
        </div>
      )}

      {!error && restaurants && restaurants.length === 0 && (
        <p className="mt-12 text-center text-sm text-muted-foreground">
          Todavía no hay restaurantes disponibles.
        </p>
      )}
    </main>
  )
}
