import { notFound } from 'next/navigation'
import { createClient } from '@/lib/db/server'
import { ProductForm } from '@/components/features/products/ProductForm'

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  // Si el producto no es del restaurante del usuario, la policy RLS
  // "products_select_owner" simplemente no devuelve la fila — por eso
  // basta con chequear !product para cubrir "no existe" Y "no es tuyo".
  const { data: product } = await supabase
    .from('products')
    .select(
      'id, name, description, price, image_url, image_file_id, available, category_id, restaurant_id'
    )
    .eq('id', id)
    .single()

  if (!product) {
    notFound()
  }

  const { data: categories } = await supabase
    .from('categories')
    .select('id, name')
    .order('sort_order', { ascending: true })

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">
        Editar {product.name}
      </h1>

      <div className="mt-6">
        <ProductForm
          productId={product.id}
          categories={categories ?? []}
          restaurantId={product.restaurant_id}
          initialData={{
            name: product.name,
            description: product.description ?? '',
            price: String(product.price),
            imageUrl: product.image_url ?? '',
            imageFileId: product.image_file_id ?? '',
            available: product.available,
            categoryId: product.category_id ?? '',
          }}
        />
      </div>
    </div>
  )
}