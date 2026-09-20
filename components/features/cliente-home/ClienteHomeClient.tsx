'use client'

import { useMemo, useState } from 'react'
import { SearchIcon, FlameIcon, ClockIcon } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { RestaurantCard, type RestaurantCardData } from '@/components/features/restaurants/RestaurantCard'
import { FeaturedProductCard, type FeaturedProduct } from '@/components/features/products/FeaturedProductCard'
import { cn } from '@/lib/utils'

export function ClienteHomeClient({
  restaurants,
  popularProducts,
}: {
  restaurants: RestaurantCardData[]
  popularProducts: FeaturedProduct[]
}) {
  const [search, setSearch] = useState('')
  const [activeType, setActiveType] = useState<string | null>(null)

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

  return (
    <div className="space-y-10 pb-6">
      {/* Hero — gradiente de marca + tarjeta de búsqueda glass */}
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
            ¿Qué se te antoja hoy?
          </h1>
          <p className="mt-1.5 max-w-md text-sm text-white/85 sm:text-base">
            Pide en tus negocios favoritos y recíbelo directo en tu puerta.
          </p>

          <div className="relative mt-6 max-w-md rounded-full bg-white/95 p-1 shadow-lg backdrop-blur">
            <SearchIcon className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Busca un restaurante o tipo de comida..."
              className="h-11 rounded-full border-0 bg-transparent pl-11 text-sm text-foreground shadow-none focus-visible:ring-0"
            />
          </div>
        </div>
      </section>

      {/* Categorías */}
      {foodTypes.length > 0 && (
        <section className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          <button
            type="button"
            onClick={() => setActiveType(null)}
            aria-pressed={activeType === null}
            className={cn(
              'shrink-0 rounded-full border px-4 py-1.5 text-sm font-medium backdrop-blur transition-colors',
              activeType === null
                ? 'border-brand-500 bg-brand-500 text-white shadow-sm shadow-brand-500/30'
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
                'shrink-0 rounded-full border px-4 py-1.5 text-sm font-medium backdrop-blur transition-colors',
                activeType === type
                  ? 'border-brand-500 bg-brand-500 text-white shadow-sm shadow-brand-500/30'
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
          <div className="flex snap-x gap-4 overflow-x-auto pb-2">
            {popularProducts.map((product) => (
              <FeaturedProductCard key={product.id} product={product} />
            ))}
          </div>
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
          <div className="flex flex-col items-center rounded-3xl border border-dashed px-6 py-14 text-center">
            <p className="font-medium">No encontramos negocios para tu búsqueda</p>
            <p className="mt-1 max-w-xs text-sm text-muted-foreground">
              Prueba con otro nombre o quita los filtros.
            </p>
          </div>
        )}
      </section>
    </div>
  )
}