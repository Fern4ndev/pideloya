import { createClient } from '@/lib/db/server'
import { ProfileForm } from '@/components/features/profile/ProfileForm'
import { ClientPageContainer } from '@/components/layout/ClientPageContainer'

export default async function ClienteProfilePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, full_name, phone')
    .eq('auth_id', user!.id)
    .single()

  const { data: address } = await supabase
    .from('addresses')
    .select('id, label, address_text, reference, latitude, longitude')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return (
    <ClientPageContainer size="narrow">
      <h1 className="text-2xl font-semibold tracking-tight">Mi perfil</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Administra tus datos y la dirección donde recibes tus pedidos.
      </p>
      <div className="mt-6 sm:mt-8">
        <ProfileForm
          email={user!.email ?? ''}
          showAccountAvatar
          initialData={{
            fullName: profile?.full_name ?? '',
            phone: profile?.phone ?? '',
          }}
          address={address}
        />
      </div>
    </ClientPageContainer>
  )
}