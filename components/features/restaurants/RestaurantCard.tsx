import Link from 'next/link'
import Image from 'next/image'
import { MapPinIcon, ChevronRightIcon, UtensilsCrossedIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'

export interface RestaurantCardData {
  slug: string
  name: string
  description: string | null
  logo_url: string | null
  address_text: string | null
  food_type?: string | null
}

export function RestaurantCard({ restaurant }: { restaurant: RestaurantCardData }) {
  return (
    <Link href={`/restaurantes/${restaurant.slug}`} className="group block h-full">
      <Card className="h-full overflow-hidden border-border/70 p-0 transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-lg">
        <div className="relative aspect-[16/10] w-full overflow-hidden bg-muted">
          {restaurant.logo_url ? (
            <Image
              src={restaurant.logo_url}
              alt={restaurant.name}
              fill
              sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
              className="object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-brand-100 to-brand-50 text-brand-400">
              <UtensilsCrossedIcon className="h-10 w-10" />
            </div>
          )}
          {restaurant.food_type && (
            <Badge className="absolute left-3 top-3 border-0 bg-white/90 text-foreground shadow-sm backdrop-blur">
              {restaurant.food_type}
            </Badge>
          )}
        </div>

        <CardContent className="flex items-start justify-between gap-2 py-4">
          <div className="min-w-0">
            <h3 className="truncate text-base font-semibold group-hover:text-brand-600">
              {restaurant.name}
            </h3>
            {restaurant.description && (
              <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">
                {restaurant.description}
              </p>
            )}
            {restaurant.address_text && (
              <p className="mt-1.5 flex items-center gap-1 truncate text-xs text-muted-foreground/80">
                <MapPinIcon className="h-3 w-3 shrink-0" />
                {restaurant.address_text}
              </p>
            )}
          </div>
          <ChevronRightIcon className="mt-1 h-4 w-4 shrink-0 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5 group-hover:text-brand-500" />
        </CardContent>
      </Card>
    </Link>
  )
}