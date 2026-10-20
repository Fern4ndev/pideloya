import { notFound } from 'next/navigation'
import { getPublicRestaurantMenu } from '@/lib/db/public'
import { RestaurantMenuView } from '@/components/features/restaurants/RestaurantMenuView'

export default async function RestaurantMenuPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params

  // Caché pública con tag 'restaurants' (invalidada por las actions de
  // mutación); null → no existe / no está aprobado → 404.
  const menu = await getPublicRestaurantMenu(slug)

  if (!menu) notFound()

  const { restaurant, hours, products, categories } = menu

  return (
    <RestaurantMenuView
      restaurant={restaurant}
      products={products}
      categories={categories}
      hours={hours}
    />
  )
}