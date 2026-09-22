import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { RestaurantSidebar } from '@/components/layout/RestaurantSidebar'

export default async function RestauranteLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const h = await headers()
  const role = h.get('x-user-role')
  const isActive = h.get('x-user-active')
  const fullName = h.get('x-user-name') || 'Restaurante'

  if (role !== 'RESTAURANT' || isActive !== 'true') redirect('/login')

  return (
    <div className="flex h-screen overflow-hidden">
      <RestaurantSidebar fullName={fullName} />
      <main className="flex-1 overflow-y-auto px-8 pt-16 pb-6 lg:py-6">{children}</main>
    </div>
  )
}