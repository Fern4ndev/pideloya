import Link from 'next/link'
import Image from 'next/image'
import { Card, CardContent } from '@/components/ui/card'

export interface RestaurantCardData {
  slug: string
  name: string
  description: string | null
  logo_url: string | null
  address_text: string | null
}

export function RestaurantCard({ restaurant }: { restaurant: RestaurantCardData }) {
  return (
    <Link href={`/restaurantes/${restaurant.slug}`} className="group block">
      <Card className="flex-row gap-4 border-border/70 p-4 transition hover:border-foreground/20 hover:shadow-sm">
        <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-muted">
          {restaurant.logo_url ? (
            <Image
              src={restaurant.logo_url}
              alt={restaurant.name}
              fill
              sizes="64px"
              className="object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-lg font-medium text-muted-foreground">
              {restaurant.name.charAt(0)}
            </div>
          )}
        </div>

        <CardContent className="min-w-0 flex-1 p-0">
          <h3 className="truncate text-sm font-semibold group-hover:text-accent">
            {restaurant.name}
          </h3>
          {restaurant.description && (
            <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">
              {restaurant.description}
            </p>
          )}
          {restaurant.address_text && (
            <p className="mt-1 truncate text-xs text-muted-foreground/70">
              {restaurant.address_text}
            </p>
          )}
        </CardContent>
      </Card>
    </Link>
  )
}