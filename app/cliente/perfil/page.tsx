import { createClient } from '@/lib/db/server'
import { ProfileForm } from '@/components/features/profile/ProfileForm'

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
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Mi perfil</h1>
      <div className="mt-6">
        <ProfileForm
          email={user!.email ?? ''}
          initialData={{
            fullName: profile?.full_name ?? '',
            phone: profile?.phone ?? '',
          }}
        />
      </div>
    </div>
  )
}