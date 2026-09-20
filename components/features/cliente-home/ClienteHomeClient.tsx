'use client'

import { useMemo, useState } from 'react'
import { SearchIcon, FlameIcon } from 'lucide-react'
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
      {/* Hero + búsqueda */}
      <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-brand-500 via-brand-600 to-brand-700 px-6 py-10 text-white sm:px-10 sm:py-14">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          ¿Qué se te antoja hoy?
        </h1>
        <p className="mt-1.5 text-sm text-white/85 sm:text-base">
          Pide en tus negocios favoritos de Abancay y recíbelo en minutos.
        </p>

        <div className="relative mt-6 max-w-md">
          <SearchIcon className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Busca un restaurante o tipo de comida..."
            className="h-12 rounded-full border-0 bg-white pl-11 text-sm text-foreground shadow-md focus-visible:ring-white/50"
          />
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
              'shrink-0 rounded-full border px-4 py-1.5 text-sm font-medium transition-colors',
              activeType === null
                ? 'border-brand-500 bg-brand-500 text-white'
                : 'border-border bg-background text-muted-foreground hover:border-brand-300 hover:text-foreground'
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
                'shrink-0 rounded-full border px-4 py-1.5 text-sm font-medium transition-colors',
                activeType === type
                  ? 'border-brand-500 bg-brand-500 text-white'
                  : 'border-border bg-background text-muted-foreground hover:border-brand-300 hover:text-foreground'
              )}
            >
              {type}
            </button>
          ))}
        </section>
      )}

      {/* Platos populares — quick add, se oculta mientras hay filtros activos */}
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
              <RestaurantCard key={restaurant.slug} restaurant={restaurant} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center rounded-xl border border-dashed px-6 py-14 text-center">
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