import { redirect } from 'next/navigation'
import { createClient } from '@/lib/db/server'
import { CustomerHeader } from '@/components/layout/CustomerHeader'

export default async function ClienteLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // El middleware ya protege esta ruta, pero un layout nunca debe asumir
  // que el usuario existe — se vuelve a verificar aquí como red de seguridad.
  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, is_active, full_name')
    .eq('auth_id', user.id)
    .single()

  if (!profile || profile.role !== 'CUSTOMER' || !profile.is_active) {
    redirect('/login')
  }

  return (
    <div className="min-h-screen bg-background">
      <CustomerHeader fullName={profile?.full_name ?? 'Cliente'} />
      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
    </div>
  )
}