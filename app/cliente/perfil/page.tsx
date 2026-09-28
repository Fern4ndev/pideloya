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
    .select('full_name, phone')
    .eq('auth_id', user!.id)
    .single()

  return (
    <ClientPageContainer size="narrow">
      <h1 className="text-2xl font-semibold tracking-tight">Mi perfil</h1>
      <div className="mt-6">
        <ProfileForm
          email={user!.email ?? ''}
          showAccountAvatar
          initialData={{
            fullName: profile?.full_name ?? '',
            phone: profile?.phone ?? '',
          }}
        />
      </div>
    </ClientPageContainer>
  )
}