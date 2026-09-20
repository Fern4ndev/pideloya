import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { CustomerHeader } from '@/components/layout/CustomerHeader'
import { CartBar } from '@/components/features/cart/CartBar'

export default async function ClienteLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const h = await headers()
  const role = h.get('x-user-role')
  const isActive = h.get('x-user-active')
  const fullName = h.get('x-user-name') || 'Cliente'

  if (role !== 'CUSTOMER' || isActive !== 'true') redirect('/login')

  return (
    <div className="min-h-screen bg-background">
      <CustomerHeader fullName={fullName} />
      <main className="mx-auto max-w-5xl px-4 py-6 pb-24">{children}</main>
      <CartBar />
    </div>
  )
}