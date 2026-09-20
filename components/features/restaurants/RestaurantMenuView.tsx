import Image from 'next/image'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ProductOrderCard } from '@/components/features/products/ProductOrderCard'

export interface RestaurantMenuData {
  id: string
  name: string
  description: string | null
  logo_url: string | null
  address_text: string | null
  whatsapp: string | null
  food_type: string | null
}

export interface MenuProduct {
  id: string
  name: string
  description: string | null
  price: number
  image_url: string | null
  category_id: string | null
}

export function RestaurantMenuView({
  restaurant,
  products,
  categories,
}: {
  restaurant: RestaurantMenuData
  products: MenuProduct[]
  categories: { id: string; name: string }[]
}) {
  const productsByCategory = categories
    .map((category) => ({
      category,
      products: products.filter((p) => p.category_id === category.id),
    }))
    .filter((group) => group.products.length > 0)

  const uncategorized = products.filter((p) => !p.category_id)

  const whatsappLink = restaurant.whatsapp
    ? `https://wa.me/51${restaurant.whatsapp}?text=${encodeURIComponent(
        `Hola, quiero hacer un pedido en ${restaurant.name} desde PideloYa`
      )}`
    : null

  return (
    <div className="mx-auto max-w-3xl px-4 pb-10 pt-6">
      {/* Banner con gradiente de marca */}
      <div className="relative h-28 overflow-hidden rounded-[28px] bg-gradient-to-br from-brand-500 via-brand-600 to-violet sm:h-36">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/15 blur-3xl"
        />
      </div>

      {/* Tarjeta flotante — efecto glass sobre el banner */}
      <div className="relative z-10 -mt-12 sm:-mt-14">
        <div className="flex gap-4 rounded-3xl border border-black/5 bg-white/80 p-4 shadow-lg backdrop-blur-xl dark:border-white/10 dark:bg-neutral-900/70">
          <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-muted ring-4 ring-white dark:ring-neutral-900">
            {restaurant.logo_url ? (
              <Image src={restaurant.logo_url} alt={restaurant.name} fill sizes="80px" className="object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-2xl font-semibold text-muted-foreground">
                {restaurant.name.charAt(0)}
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <h1 className="truncate text-xl font-semibold tracking-tight">{restaurant.name}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              {restaurant.food_type && (
                <Badge className="bg-brand-500 text-white">{restaurant.food_type}</Badge>
              )}
              {restaurant.address_text && (
                <span className="truncate text-sm text-muted-foreground">{restaurant.address_text}</span>
              )}
            </div>
            {restaurant.description && (
              <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{restaurant.description}</p>
            )}
          </div>
        </div>

        {whatsappLink && (
          <Button
            variant="outline"
            size="sm"
            className="mt-4 rounded-full"
            render={<a href={whatsappLink} target="_blank" rel="noopener noreferrer" />}
            nativeButton={false}
          >
            Pedir por WhatsApp
          </Button>
        )}
      </div>

      <div className="mt-8 space-y-8">
        {products.length > 0 ? (
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
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Otros</h2>
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
          <p className="text-sm text-muted-foreground">Este negocio todavía no tiene productos publicados.</p>
        )}
      </div>
    </div>
  )
}