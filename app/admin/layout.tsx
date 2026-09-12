import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { AdminSidebar } from '@/components/layout/AdminSidebar'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const h = await headers()
  const role = h.get('x-user-role')
  const isActive = h.get('x-user-active')

  if (role !== 'ADMIN' || isActive !== 'true') redirect('/login')

  return (
    <div className="flex min-h-screen">
      <AdminSidebar />
      <main className="flex-1 overflow-y-auto px-8 py-6">{children}</main>
    </div>
  )
}
