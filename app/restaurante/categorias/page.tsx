import { createClient } from '@/lib/db/server'
import { CategoryManager } from '@/components/features/categories/CategoryManager'
import { PageHeader } from '@/components/layout/PageHeader'
import { PageContainer } from '@/components/layout/PageContainer'
import { Card, CardContent } from '@/components/ui/card'

export default async function CategoriesPage() {
  const supabase = await createClient()

  const { data: categories } = await supabase
    .from('categories')
    .select('id, name')
    .order('sort_order', { ascending: true })

  return (
    <PageContainer size="sm">
      <PageHeader
        title="Categorías"
        description="Organiza tu carta — ej. Entradas, Platos de fondo, Bebidas."
      />

      <Card className="mt-6">
        <CardContent>
          <CategoryManager initialCategories={categories ?? []} />
        </CardContent>
      </Card>
    </PageContainer>
  )
}