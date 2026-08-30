import { redirect } from 'next/navigation'
import { createClient } from '@/lib/db/server'
import { DeliverySidebar } from '@/components/layout/DeliverySidebar'

export default async function RepartidorLayout({
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
    .select('role')
    .eq('auth_id', user.id)
    .single()

  if (profile?.role !== 'DELIVERY') redirect('/login')

  return (
    <div className="flex min-h-screen">
      <DeliverySidebar />
      <main className="flex-1 overflow-y-auto px-8 py-6">{children}</main>
    </div>
  )
}