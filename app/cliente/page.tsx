import { createClient } from '@/lib/db/server'
import {
  RestaurantCard,
  type RestaurantCardData,
} from '@/components/features/restaurants/RestaurantCard'

export default async function ClienteHomePage() {
  const supabase = await createClient()

  // La policy "restaurants_select_public" (RLS) ya filtra por
  // is_approved = true y is_active = true — no hace falta repetirlo aquí.
  const { data: restaurants, error } = await supabase
    .from('restaurants')
    .select('slug, name, description, logo_url, address_text')
    .order('name')

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">
        Negocios en Abancay
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Elige un negocio para ver su carta y armar tu pedido.
      </p>

      {error && (
        <p className="mt-6 rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
          No pudimos cargar los negocios. Intenta recargar la página.
        </p>
      )}

      {!error && restaurants && restaurants.length === 0 && <EmptyState />}

      {!error && restaurants && restaurants.length > 0 && (
        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {(restaurants as RestaurantCardData[]).map((restaurant) => (
            <RestaurantCard key={restaurant.slug} restaurant={restaurant} />
          ))}
        </div>
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