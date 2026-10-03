import { getPublicRestaurants } from '@/lib/db/public'
import { RestaurantCard } from '@/components/features/restaurants/RestaurantCard'

// Caché pública (Fase 2): la consulta sale de unstable_cache con tag
// 'restaurants' y se invalida desde las actions de mutación. Sin
// force-dynamic ni cookies() la página se puede prerenderear estáticamente.
export default async function RestaurantesPage() {
  const restaurants = await getPublicRestaurants()

  const error = restaurants === null

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
