import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { DeliverySidebar } from '@/components/layout/DeliverySidebar'

export default async function RepartidorLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const h = await headers()
  const role = h.get('x-user-role')
  const isActive = h.get('x-user-active')
  const fullName = h.get('x-user-name') || 'Repartidor'

  if (role !== 'DELIVERY' || isActive !== 'true') redirect('/login')

  return (
    <div className="flex h-screen overflow-hidden">
      <DeliverySidebar fullName={fullName} />
      <main className="flex-1 overflow-y-auto px-8 py-6">{children}</main>
    </div>
  )
}