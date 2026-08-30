import { createClient } from '@/lib/db/server'
import { ProductForm } from '@/components/features/products/ProductForm'

export default async function NewProductPage() {
  const supabase = await createClient()

  const { data: categories } = await supabase
    .from('categories')
    .select('id, name')
    .order('sort_order', { ascending: true })

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">
        Nuevo producto
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Va a aparecer disponible de inmediato en tu carta, a menos que
        desactives el interruptor de abajo.
      </p>

      <div className="mt-6">
        <ProductForm categories={categories ?? []} />
      </div>
    </div>
  )
}