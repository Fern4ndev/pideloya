'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { FlameIcon, ClockIcon, SearchIcon } from 'lucide-react'
import { RestaurantCard, type RestaurantCardData } from '@/components/features/restaurants/RestaurantCard'
import { FeaturedProductCard, type FeaturedProduct } from '@/components/features/products/FeaturedProductCard'
import type { LogoItem } from '@/components/LogoLoop'
import { useSearchStore } from '@/lib/hooks/use-search'
import { withImageKitTransform } from '@/lib/images/imagekit-transform'
import { cn } from '@/lib/utils'
import { EmptyState } from '@/components/ui/empty-state'
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselPrevious,
  CarouselNext,
} from '@/components/ui/carousel'

// Fase 4: el loop animado (requestAnimationFrame constante) se carga SOLO si
// la sección llega a entrar en viewport — ssr:false saca su JS del HTML
// inicial y del hidratado, y el IntersectionObserver pospone incluso el
// import del chunk hasta que haga falta (rootMargin 200px lo precarga antes
// de que sea visible).
const LogoLoop = dynamic(() => import('@/components/LogoLoop').then((m) => m.LogoLoop), {
  ssr: false,
  loading: () => <div className="h-16" aria-hidden="true" />,
})

export function ClienteHomeClient({
  greeting,
  restaurants,
  popularProducts,
  closedRestaurantIds,
}: {
  greeting: string
  restaurants: RestaurantCardData[]
  popularProducts: FeaturedProduct[]
  closedRestaurantIds?: string[]
}) {
  // El término de búsqueda ahora vive en el navbar (CustomerHeader) —
  // aquí solo lo leemos para filtrar la lista de negocios.
  const search = useSearchStore((s) => s.query)
  const [activeType, setActiveType] = useState<string | null>(null)

  // Fase 4: montar el LogoLoop solo cuando su sección se acerca al viewport.
  const loopSectionRef = useRef<HTMLElement | null>(null)
  const [loopMounted, setLoopMounted] = useState(false)
  useEffect(() => {
    const el = loopSectionRef.current
    if (!el || loopMounted) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setLoopMounted(true)
          observer.disconnect()
        }
      },
      { rootMargin: '200px 0px' }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [loopMounted])

  const foodTypes = useMemo(() => {
    const set = new Set<string>()
    restaurants.forEach((r) => {
      if (r.food_type) set.add(r.food_type)
    })
    return Array.from(set).sort()
  }, [restaurants])

  const filteredRestaurants = useMemo(() => {
    const query = search.trim().toLowerCase()
    return restaurants.filter((r) => {
      if (activeType && r.food_type !== activeType) return false
      if (!query) return true
      return (
        r.name.toLowerCase().includes(query) ||
        (r.food_type ?? '').toLowerCase().includes(query) ||
        (r.description ?? '').toLowerCase().includes(query)
      )
    })
  }, [restaurants, search, activeType])

  const hasFilters = search.trim().length > 0 || activeType !== null

  const restaurantLogos: LogoItem[] = useMemo(
    () =>
      restaurants.map((r) => ({
        title: r.name,
        node: (
          <a
            href={`/cliente/restaurantes/${r.slug}`}
            title={r.name}
            className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-white shadow-client-card ring-1 ring-black/5 transition-transform duration-150 hover:scale-105 dark:bg-neutral-900 dark:ring-white/10"
          >
            {
              r.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={withImageKitTransform(r.logo_url, 160)}
                  alt={r.name}
                  className="h-full w-full object-cover"
                  loading="lazy"
                  decoding="async"
                />
              ) : (
                <span className="text-sm font-semibold text-muted-foreground">
                  {r.name.charAt(0)}
                </span>
              )
            }
          </a >
        ),
      })),
    [restaurants]
  )

  return (
    <div className="space-y-10 pb-6">
      <section className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-brand-500 via-brand-600 to-violet px-6 py-10 text-white shadow-lg shadow-brand-500/20 sm:px-10 sm:py-14">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/20 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-20 left-10 h-48 w-48 rounded-full bg-lime/20 blur-3xl"
        />

        <div className="relative z-10">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs font-medium backdrop-blur">
            <ClockIcon className="h-3.5 w-3.5" />
            Entrega rápida en Abancay
          </span>

          <h1 className="mt-4 text-2xl font-bold tracking-tight sm:text-3xl">
            {greeting}
          </h1>
          <p className="mt-1.5 max-w-md text-sm text-white/85 sm:text-base">
            ¿Qué se te antoja hoy? Pide en tus negocios favoritos y recíbelo
            directo en tu puerta.
          </p>
        </div>
      </section>

      {restaurantLogos.length > 0 && (
        <section ref={loopSectionRef} className="-mx-1">
          {/* Reserva de alto para que el layout no salte mientras el chunk
              carga (el placeholder del dynamic() mide lo mismo). */}
          <div className="min-h-16">
            {loopMounted && (
              <LogoLoop
                logos={restaurantLogos}
                logoHeight={56}
                gap={24}
                speed={35}
                fadeOut
                pauseOnHover
                ariaLabel="Restaurantes en PideloYa"
              />
            )}
          </div>
        </section>
      )}

      {/* Categorías */}
      {foodTypes.length > 0 && (
        <section className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          <button
            type="button"
            onClick={() => setActiveType(null)}
            aria-pressed={activeType === null}
            className={cn(
              'shrink-0 rounded-full border px-4 py-2.5 text-sm font-medium backdrop-blur transition-all duration-150 active:scale-95',
              activeType === null
                ? 'border-brand-500 bg-brand-500 text-white shadow-client-card'
                : 'border-black/5 bg-white/70 text-muted-foreground hover:border-brand-300 hover:text-foreground dark:border-white/10 dark:bg-white/5'
            )}
          >
            Todos
          </button>
          {foodTypes.map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setActiveType(type)}
              aria-pressed={activeType === type}
              className={cn(
                'shrink-0 rounded-full border px-4 py-2.5 text-sm font-medium backdrop-blur transition-all duration-150 active:scale-95',
                activeType === type
                  ? 'border-brand-500 bg-brand-500 text-white shadow-client-card'
                  : 'border-black/5 bg-white/70 text-muted-foreground hover:border-brand-300 hover:text-foreground dark:border-white/10 dark:bg-white/5'
              )}
            >
              {type}
            </button>
          ))}
        </section>
      )}

      {/* Platos populares */}
      {popularProducts.length > 0 && !hasFilters && (
        <section>
          <div className="mb-3 flex items-center gap-1.5">
            <FlameIcon className="h-4 w-4 text-brand-500" />
            <h2 className="text-lg font-semibold tracking-tight">Platos populares</h2>
          </div>
          <Carousel
            opts={{ align: 'start' }}
            className="w-full"
          >
            <CarouselContent className="select-none">
              {popularProducts.map((product) => (
                <CarouselItem key={product.id} className="basis-auto pl-4">
                  <FeaturedProductCard
                    product={product}
                    disabled={closedRestaurantIds?.includes(product.restaurant.id)}
                  />
                </CarouselItem>
              ))}
            </CarouselContent>
            <CarouselPrevious
              size="icon"
              className="hidden h-10 w-10 rounded-full bg-background shadow-sm xl:flex"
            />
            <CarouselNext
              size="icon"
              className="hidden h-10 w-10 rounded-full bg-background shadow-sm xl:flex"
            />
          </Carousel>
        </section>
      )}

      {/* Restaurantes */}
      <section>
        <h2 className="mb-3 text-lg font-semibold tracking-tight">
          {hasFilters ? 'Resultados' : 'Restaurantes en Abancay'}
        </h2>

        {filteredRestaurants.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredRestaurants.map((restaurant) => (
              <RestaurantCard
                key={restaurant.slug}
                restaurant={restaurant}
                basePath="/cliente/restaurantes"
              />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={SearchIcon}
            title="No encontramos negocios para tu búsqueda"
            description="Prueba con otro nombre o quita los filtros."
            className="rounded-3xl"
          />
        )}
      </section>
    </div>
  )
}