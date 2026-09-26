import { createClient } from '@/lib/db/server'
import { ProductForm } from '@/components/features/products/ProductForm'
import { PageHeader } from '@/components/layout/PageHeader'
import { PageContainer } from '@/components/layout/PageContainer'

export default async function NewProductPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('auth_id', user!.id)
    .single()

  const { data: member } = await supabase
    .from('restaurant_members')
    .select('restaurant_id')
    .eq('user_id', profile!.id)
    .single()

  // Filtramos explícitamente por nuestro restaurante: la policy pública
  // "categories_select_customer" no excluía al rol RESTAURANT, así que sin
  // este .eq() el Select mostraría categorías de otros restaurantes.
  const { data: categories } = await supabase
    .from('categories')
    .select('id, name')
    .eq('restaurant_id', member!.restaurant_id)
    .order('sort_order', { ascending: true })

  return (
    <PageContainer size="md">
      <PageHeader
        title="Nuevo producto"
        description="Va a aparecer disponible de inmediato en tu carta, a menos que desactives el interruptor de abajo."
      />

      <div className="mt-6">
        <ProductForm
          categories={categories ?? []}
          restaurantId={member!.restaurant_id}
        />
      </div>
    </PageContainer>
  )
}