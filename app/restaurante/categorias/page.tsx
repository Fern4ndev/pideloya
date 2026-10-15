import { redirect } from 'next/navigation'
import { createClient } from '@/lib/db/server'
import { CategoryManager } from '@/components/features/categories/CategoryManager'
import { CategoryCreateDialog } from '@/components/features/categories/CategoryCreateDialog'
import { PageHeader } from '@/components/layout/PageHeader'
import { PageContainer } from '@/components/layout/PageContainer'

export default async function CategoriesPage() {
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

  const restaurantId = member?.restaurant_id ?? null

  if (!restaurantId) redirect('/restaurante')

  // Defensa en profundidad: además de la policy "categories_select_owner",
  // filtramos explícitamente por nuestro restaurante. La policy pública
  // "categories_select_customer" (migración 20260920201230) no excluía al rol
  // RESTAURANT, así que confiar solo en RLS mostraba las categorías ajenas.
  const { data: categories } = await supabase
    .from('categories')
    .select('id, name')
    .eq('restaurant_id', restaurantId)
    .order('sort_order', { ascending: true })

  return (
    <PageContainer size="full">
      <PageHeader
        title="Categorías"
        description="Organiza tu carta — ej. Entradas, Platos de fondo, Bebidas."
        action={<CategoryCreateDialog />}
      />

      <div className="mt-6">
        <CategoryManager initialCategories={categories ?? []} />
      </div>
    </PageContainer>
  )
}
