import { createClient } from '@/lib/db/server'
import { RestaurantTable } from '@/components/features/admin/RestaurantTable'

export default async function AdminRestaurantsPage() {
  const supabase = await createClient()

  const { data: restaurants, error } = await supabase
    .from('restaurants')
    .select(
      'id, name, slug, address_text, whatsapp, food_type, is_approved, is_active, created_at, restaurant_members(profiles(full_name))'
    )
    .order('created_at', { ascending: false })

  return (
    <div>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Restaurantes
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Revisa y administra los negocios que se registraron desde la página
          principal.
        </p>
      </div>

      {error && (
        <p className="mt-6 text-sm text-destructive">
          No se pudo cargar la lista de restaurantes.
        </p>
      )}

      {!error && restaurants && restaurants.length > 0 && (
        <RestaurantTable restaurants={restaurants} />
      )}

      {!error && restaurants && restaurants.length === 0 && (
        <p className="mt-10 text-center text-sm text-muted-foreground">
          Todavía no hay restaurantes registrados.
        </p>
      )}
    </div>
  )
}
