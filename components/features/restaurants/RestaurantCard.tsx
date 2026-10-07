import Link from 'next/link'
import Image from 'next/image'
import { MapPinIcon, UtensilsCrossedIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'

export interface RestaurantCardData {
  slug: string
  name: string
  description: string | null
  logo_url: string | null
  cover_url?: string | null
  address_text: string | null
  food_type?: string | null
  isOpen?: boolean
}

export function RestaurantCard({
  restaurant,
  basePath = '/restaurantes',
}: {
  restaurant: RestaurantCardData
  basePath?: string
}) {
  return (
    <Link href={`${basePath}/${restaurant.slug}`} className="group block h-full">
      <Card className="h-full overflow-hidden border-0 bg-white/70 p-0 shadow-client-card ring-1 ring-black/5 backdrop-blur-xl transition-all duration-300 ease-client hover:-translate-y-1 hover:shadow-client-card-hover hover:ring-brand-300 dark:bg-white/5 dark:ring-white/10">
        <div className="relative aspect-[16/10] w-full overflow-hidden bg-muted">
          {restaurant.cover_url ? (
            <Image
              src={restaurant.cover_url}
              alt={restaurant.name}
              fill
              sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
              className="object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-stone-200 via-stone-100 to-stone-200 dark:from-neutral-800 dark:via-neutral-900 dark:to-neutral-800">
              <UtensilsCrossedIcon className="h-10 w-10 text-muted-foreground/50" />
            </div>
          )}
          {/* Velo de "no disponible ahora": comunica el estado con la tarjeta
              entera, no sólo con el badge de la esquina. */}
          {restaurant.isOpen === false && (
            <div aria-hidden className="absolute inset-0 bg-white/40" />
          )}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
          <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
            {restaurant.isOpen === false && (
              <Badge className="border-0 bg-background/95 text-muted-foreground shadow-sm backdrop-blur">
                Cerrado
              </Badge>
            )}
            {restaurant.food_type && (
              <Badge className="border-0 bg-white/90 text-foreground shadow-sm backdrop-blur">
                {restaurant.food_type}
              </Badge>
            )}
          </div>
          {/* Siempre visible (atenuado por fondo semitransparente, no por
              `opacity`: bajar la opacidad del pill completo también baja el
              contraste del texto). En táctil no existe `:hover`, así que un
              affordance que sólo aparece al pasar el mouse nunca se ve. */}
          <span className="absolute bottom-3 right-3 rounded-full bg-white/95 px-3 py-1 text-xs font-semibold text-brand-700 shadow-md backdrop-blur-sm transition-all duration-300 ease-client group-hover:bg-white group-hover:shadow-lg group-focus-visible:bg-white">
            Ver menú
          </span>
        </div>

        <CardContent className="py-4">
          <div className="flex items-start gap-3">
            {/* Logo en cuadrado con bordes redondeados al costado del nombre */}
            <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-2xl bg-muted ring-1 ring-black/5 dark:ring-white/10">
              {restaurant.logo_url ? (
                <Image
                  src={restaurant.logo_url}
                  alt=""
                  fill
                  sizes="56px"
                  className="object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-lg font-semibold text-muted-foreground">
                  {restaurant.name.charAt(0)}
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="truncate text-base font-semibold group-hover:text-brand-700">
                {restaurant.name}
              </h3>
              {/* Reserva de 2 líneas como en ProductOrderCard: las cards de
                  una misma fila no se deforman haya o no descripción. */}
              <p
                aria-hidden={restaurant.description ? undefined : true}
                className="mt-0.5 line-clamp-2 min-h-10 text-sm text-muted-foreground"
              >
                {restaurant.description ?? ''}
              </p>
              {restaurant.address_text && (
                <p className="mt-1.5 flex items-center gap-1 truncate text-xs text-muted-foreground/80">
                  <MapPinIcon className="h-3 w-3 shrink-0" />
                  {restaurant.address_text}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}