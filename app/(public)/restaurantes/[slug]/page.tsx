import { notFound } from 'next/navigation'
import Image from 'next/image'
import { createClient } from '@/lib/db/server'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ProductOrderCard } from '@/components/features/products/ProductOrderCard'

export default async function RestaurantMenuPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const supabase = await createClient()

  // La policy RLS "restaurants_select_public" ya filtra por
  // is_approved=true e is_active=true — si no cumple, esto viene null.
  const { data: restaurant } = await supabase
    .from('restaurants')
    .select(
      'id, name, description, logo_url, address_text, whatsapp, food_type'
    )
    .eq('slug', slug)
    .maybeSingle()

  if (!restaurant) {
    notFound()
  }

  const { data: products } = await supabase
    .from('products')
    .select('id, name, description, price, image_url, category_id')
    .eq('restaurant_id', restaurant.id)
    .eq('available', true)
    .order('created_at', { ascending: false })

  const { data: categories } = await supabase
    .from('categories')
    .select('id, name')
    .eq('restaurant_id', restaurant.id)
    .order('sort_order', { ascending: true })

  // Agrupa los productos por categoría, y deja un grupo aparte para los
  // que no tienen ninguna asignada.
  const productsByCategory = (categories ?? []).map((category) => ({
    category,
    products: (products ?? []).filter((p) => p.category_id === category.id),
  })).filter((group) => group.products.length > 0)

  const uncategorized = (products ?? []).filter((p) => !p.category_id)

  const whatsappLink = restaurant.whatsapp
    ? `https://wa.me/51${restaurant.whatsapp}?text=${encodeURIComponent(
        `Hola, quiero hacer un pedido en ${restaurant.name} desde PideloYa`
      )}`
    : null

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <div className="flex gap-4">
        <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-muted">
          {restaurant.logo_url ? (
            <Image
              src={restaurant.logo_url}
              alt={restaurant.name}
              fill
              sizes="80px"
              className="object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-2xl font-semibold text-muted-foreground">
              {restaurant.name.charAt(0)}
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-semibold tracking-tight">
            {restaurant.name}
          </h1>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            {restaurant.food_type && (
              <Badge variant="secondary">{restaurant.food_type}</Badge>
            )}
            {restaurant.address_text && (
              <span className="text-sm text-muted-foreground">
                {restaurant.address_text}
              </span>
            )}
          </div>
          {restaurant.description && (
            <p className="mt-2 text-sm text-muted-foreground">
              {restaurant.description}
            </p>
          )}
        </div>
      </div>

      {whatsappLink && (
        <Button
          variant="outline"
          size="sm"
          className="mt-4"
          render={
            <a href={whatsappLink} target="_blank" rel="noopener noreferrer" />
          }
          nativeButton={false}
        >
          Pedir por WhatsApp
        </Button>
      )}

      <div className="mt-8 space-y-8">
        {products && products.length > 0 ? (
          <>
            {productsByCategory.map(({ category, products: categoryProducts }) => (
              <div key={category.id}>
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  {category.name}
                </h2>
                <div className="mt-3 space-y-3">
                  {categoryProducts.map((p) => (
                    <ProductOrderCard
                      key={p.id}
                      product={{
                        id: p.id,
                        name: p.name,
                        description: p.description,
                        price: Number(p.price),
                        imageUrl: p.image_url,
                      }}
                      restaurant={{ id: restaurant.id, name: restaurant.name }}
                    />
                  ))}
                </div>
              </div>
            ))}

            {uncategorized.length > 0 && (
              <div>
                {productsByCategory.length > 0 && (
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    Otros
                  </h2>
                )}
                <div className="mt-3 space-y-3">
                  {uncategorized.map((p) => (
                    <ProductOrderCard
                      key={p.id}
                      product={{
                        id: p.id,
                        name: p.name,
                        description: p.description,
                        price: Number(p.price),
                        imageUrl: p.image_url,
                      }}
                      restaurant={{ id: restaurant.id, name: restaurant.name }}
                    />
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            Este negocio todavía no tiene productos publicados.
          </p>
        )}
      </div>
    </div>
  )
}