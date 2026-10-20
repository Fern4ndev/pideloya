'use client'

import Image from 'next/image'
import { UtensilsCrossedIcon } from 'lucide-react'
import { m } from 'motion/react'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { ProductOrderCard } from '@/components/features/products/ProductOrderCard'
import { MenuCategoryNav } from '@/components/features/restaurants/MenuCategoryNav'
import { RestaurantOpenBanner } from '@/components/features/restaurants/RestaurantOpenBanner'
import { useRestaurantOpen } from '@/lib/hooks/use-restaurant-open'
import type { RestaurantHourInput } from '@/lib/restaurants/is-open'

/**
 * Entrada escalonada de la carta: solo los primeros N productos animan para
 * no lanzar decenas de animaciones a la vez en cartas largas (ver plan de
 * vuelo al carrito). El resto se renderiza estático.
 */
const STAGGER_LIMIT = 8
const listVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05 } },
}
const itemVariants = {
  hidden: { opacity: 0, y: 14 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] as const },
  },
}

export interface RestaurantMenuData {
  id: string
  name: string
  description: string | null
  logo_url: string | null
  address_text: string | null
  food_type: string | null
  is_open: boolean
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
  hours,
}: {
  restaurant: RestaurantMenuData
  products: MenuProduct[]
  categories: { id: string; name: string }[]
  hours: RestaurantHourInput[]
}) {
  const isOpenNow = useRestaurantOpen(restaurant.is_open, hours)

  const productsByCategory = categories
    .map((category) => ({
      category,
      products: products.filter((p) => p.category_id === category.id),
    }))
    .filter((group) => group.products.length > 0)

  const uncategorized = products.filter((p) => !p.category_id)

  const navItems = [
    ...productsByCategory.map(({ category, products: categoryProducts }) => ({
      id: category.id,
      name: category.name,
      count: categoryProducts.length,
    })),
    ...(uncategorized.length > 0
      ? [{ id: 'otros', name: 'Otros', count: uncategorized.length }]
      : []),
  ]

  return (
    <div className="mx-auto max-w-5xl px-4 pb-10 pt-6">
      {/* Cover neutro piedra: el ambiente lo da el logo desenfocado (si hay)
          con un velo neutro, nunca el naranja de marca — la portada presenta
          al negocio, no compite con los CTAs. */}
      <div className="relative h-40 overflow-hidden rounded-[28px] bg-gradient-to-br from-stone-200 via-stone-100 to-stone-200 sm:h-52 dark:from-neutral-800 dark:via-neutral-900 dark:to-neutral-800">
        {restaurant.logo_url && (
          <>
            <Image
              src={restaurant.logo_url}
              alt=""
              fill
              sizes="(min-width: 640px) 1024px, 100vw"
              className="scale-110 object-cover blur-2xl"
            />
            <div
              aria-hidden="true"
              className="absolute inset-0 bg-black/10"
            />
          </>
        )}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(0,0,0,0.06),transparent_40rem)]"
        />
      </div>

      {/* Tarjeta flotante — efecto glass sobre el banner */}
      <div className="relative z-10 -mt-12 sm:-mt-14">
        <div className="flex gap-4 rounded-3xl border border-black/5 bg-white/80 p-4 shadow-client-card backdrop-blur-xl dark:border-white/10 dark:bg-neutral-900/70">
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
              <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-muted-foreground/90">{restaurant.description}</p>
            )}
          </div>
        </div>
      </div>

      <div className="mt-6">
        <RestaurantOpenBanner isOpen={restaurant.is_open} hours={hours} />
      </div>

      {/* Navegación por categorías: solo aporta con 2+ secciones. */}
      {navItems.length > 1 && (
        <div className="mt-6">
          <MenuCategoryNav items={navItems} />
        </div>
      )}

      <div className="mt-8 space-y-10">
        {products.length > 0 ? (
          <>
            {productsByCategory.map(({ category, products: categoryProducts }, index) => (
              <section
                key={category.id}
                id={`cat-${category.id}`}
                aria-label={category.name}
                className="scroll-mt-36"
              >
                {/* Separador degradado entre secciones consecutivas: la carta
                    se lee como secciones y no como una lista continua. */}
                {index > 0 && <div className="section-divider mb-6" aria-hidden />}
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    {category.name}
                  </h2>
                  <span className="rounded-full bg-black/5 px-2 py-0.5 text-[11px] font-bold tabular-nums text-muted-foreground dark:bg-white/10">
                    {categoryProducts.length}
                  </span>
                </div>
                <m.div
                  className="mt-3 grid gap-3 sm:grid-cols-2"
                  variants={listVariants}
                  initial="hidden"
                  whileInView="show"
                  viewport={{ once: true, margin: '-40px' }}
                >
                  {categoryProducts.map((p, i) =>
                    i < STAGGER_LIMIT ? (
                      <m.div key={p.id} variants={itemVariants}>
                        <ProductOrderCard
                          product={{
                            id: p.id,
                            name: p.name,
                            description: p.description,
                            price: Number(p.price),
                            imageUrl: p.image_url,
                          }}
                          restaurant={{ id: restaurant.id, name: restaurant.name }}
                          disabled={!isOpenNow}
                        />
                      </m.div>
                    ) : (
                      <div key={p.id}>
                        <ProductOrderCard
                          product={{
                            id: p.id,
                            name: p.name,
                            description: p.description,
                            price: Number(p.price),
                            imageUrl: p.image_url,
                          }}
                          restaurant={{ id: restaurant.id, name: restaurant.name }}
                          disabled={!isOpenNow}
                        />
                      </div>
                    )
                  )}
                </m.div>
              </section>
            ))}

            {uncategorized.length > 0 && (
              <section id="cat-otros" aria-label="Otros" className="scroll-mt-36">
                {productsByCategory.length > 0 && (
                  <>
                    <div className="section-divider mb-6" aria-hidden />
                    <div className="flex items-center gap-2">
                      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                        Otros
                      </h2>
                      <span className="rounded-full bg-black/5 px-2 py-0.5 text-[11px] font-bold tabular-nums text-muted-foreground dark:bg-white/10">
                        {uncategorized.length}
                      </span>
                    </div>
                  </>
                )}
                <m.div
                  className="mt-3 grid gap-3 sm:grid-cols-2"
                  variants={listVariants}
                  initial="hidden"
                  whileInView="show"
                  viewport={{ once: true, margin: '-40px' }}
                >
                  {uncategorized.map((p, i) =>
                    i < STAGGER_LIMIT ? (
                      <m.div key={p.id} variants={itemVariants}>
                        <ProductOrderCard
                          product={{
                            id: p.id,
                            name: p.name,
                            description: p.description,
                            price: Number(p.price),
                            imageUrl: p.image_url,
                          }}
                          restaurant={{ id: restaurant.id, name: restaurant.name }}
                          disabled={!isOpenNow}
                        />
                      </m.div>
                    ) : (
                      <div key={p.id}>
                        <ProductOrderCard
                          product={{
                            id: p.id,
                            name: p.name,
                            description: p.description,
                            price: Number(p.price),
                            imageUrl: p.image_url,
                          }}
                          restaurant={{ id: restaurant.id, name: restaurant.name }}
                          disabled={!isOpenNow}
                        />
                      </div>
                    )
                  )}
                </m.div>
              </section>
            )}
          </>
        ) : (
          <EmptyState
            icon={UtensilsCrossedIcon}
            title="Este negocio todavía no tiene productos publicados"
            description="Vuelve a revisar la carta más tarde."
            className="rounded-3xl"
          />
        )}
      </div>
    </div>
  )
}