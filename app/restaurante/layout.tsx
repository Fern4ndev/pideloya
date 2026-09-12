import { redirect } from 'next/navigation'
import { createClient } from '@/lib/db/server'
import { RestaurantSidebar } from '@/components/layout/RestaurantSidebar'

export default async function RestauranteLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, is_active')
    .eq('auth_id', user.id)
    .single()

  // El proxy ya protege esta ruta (incluido el caso is_active=false);
  // esto es la red de seguridad del layout.
  if (!profile || profile.role !== 'RESTAURANT' || !profile.is_active) redirect('/login')

  return (
    <div className="flex min-h-screen">
      <RestaurantSidebar />
      <main className="flex-1 overflow-y-auto px-8 py-6">{children}</main>
    </div>
  )
}