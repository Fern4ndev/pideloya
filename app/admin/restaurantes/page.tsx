import { createClient } from '@/lib/db/server'
import { RestaurantTable } from '@/components/features/admin/RestaurantTable'
import { PageHeader } from '@/components/layout/PageHeader'
import { PageContainer } from '@/components/layout/PageContainer'
import { EmptyState } from '@/components/ui/empty-state'
import { StoreIcon } from 'lucide-react'

export default async function AdminRestaurantsPage() {
  const supabase = await createClient()

  const { data: restaurants, error } = await supabase
    .from('restaurants')
    .select(
      'id, name, slug, address_text, whatsapp, food_type, is_approved, is_active, created_at, restaurant_members(profiles(full_name))'
    )
    .order('created_at', { ascending: false })

  return (
    <PageContainer size="full">
      <PageHeader
        title="Restaurantes"
        description="Revisa y administra los negocios que se registraron desde la página principal."
      />

      {error && (
        <p role="alert" className="mt-6 text-sm text-destructive">
          No se pudo cargar la lista de restaurantes.
        </p>
      )}

      {!error && restaurants && restaurants.length > 0 && (
        <RestaurantTable restaurants={restaurants} />
      )}

      {!error && restaurants && restaurants.length === 0 && (
        <EmptyState
          icon={StoreIcon}
          title="Todavía no hay restaurantes registrados"
          description="Los negocios que se registren desde la página principal aparecerán aquí."
          className="mt-10"
        />
      )}
    </PageContainer>
  )
}
