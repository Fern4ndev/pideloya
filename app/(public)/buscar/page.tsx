import { createClient } from '@/lib/db/server'
import { RestaurantCard } from '@/components/features/restaurants/RestaurantCard'
import { Input } from '@/components/ui/input'
import { SearchIcon } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function BuscarPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const supabase = await createClient()
  const { q } = await searchParams
  const query = (q ?? '').trim()
  const safe = query.replace(/[%_,()]/g, ' ')

  let restaurants: {
    slug: string
    name: string
    description: string | null
    logo_url: string | null
    address_text: string | null
    food_type: string | null
    is_open: boolean
  }[] = []
  let error = false
  let searched = false

  if (query) {
    searched = true
    const { data, error: err } = await supabase
      .from('restaurants')
      .select('slug, name, description, logo_url, address_text, food_type, is_open')
      .eq('is_approved', true)
      .eq('is_active', true)
      .or(`name.ilike.%${safe}%,food_type.ilike.%${safe}%,address_text.ilike.%${safe}%`)
      .order('name', { ascending: true })

    restaurants = data ?? []
    error = !!err
  }

  return (
    <main className="mx-auto max-w-7xl px-6 py-12">
      <h1 className="text-3xl font-semibold tracking-tight">Buscar</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Encuentra restaurantes por nombre, tipo de comida o dirección.
      </p>

      <form action="/buscar" method="GET" className="relative mt-6 max-w-md">
        <SearchIcon className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          name="q"
          defaultValue={query}
          placeholder="Ej. pollería, pizza, centro…"
          className="pl-8"
          autoComplete="off"
        />
      </form>

      {error && (
        <p className="mt-8 text-sm text-destructive">
          No se pudo realizar la búsqueda.
        </p>
      )}

      {searched && !error && restaurants.length > 0 && (
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {restaurants.map((r) => (
            <RestaurantCard
              key={r.slug}
              restaurant={{
                slug: r.slug,
                name: r.name,
                description: r.description,
                logo_url: r.logo_url,
                address_text: r.address_text,
                food_type: r.food_type,
                isOpen: r.is_open,
              }}
            />
          ))}
        </div>
      )}

      {searched && !error && restaurants.length === 0 && (
        <p className="mt-12 text-center text-sm text-muted-foreground">
          No se encontraron resultados para &quot;{query}&quot;.
        </p>
      )}

      {!searched && (
        <p className="mt-12 text-center text-sm text-muted-foreground">
          Escribe algo arriba para comenzar a buscar.
        </p>
      )}
    </main>
  )
}
