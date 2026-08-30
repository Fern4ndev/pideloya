import { createClient } from '@/lib/db/server'
import { CategoryManager } from '@/components/features/categories/CategoryManager'

export default async function CategoriesPage() {
  const supabase = await createClient()

  const { data: categories } = await supabase
    .from('categories')
    .select('id, name')
    .order('sort_order', { ascending: true })

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Categorías</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Organiza tu carta — ej. Entradas, Platos de fondo, Bebidas.
      </p>

      <div className="mt-6 max-w-md">
        <CategoryManager initialCategories={categories ?? []} />
      </div>
    </div>
  )
}