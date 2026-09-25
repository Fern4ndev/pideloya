import { createClient } from '@/lib/db/server'
import { ProfileForm } from '@/components/features/profile/ProfileForm'
import { PageHeader } from '@/components/layout/PageHeader'
import { PageContainer } from '@/components/layout/PageContainer'

export default async function AdminProfilePage() {
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
    <PageContainer size="sm">
      <PageHeader
        title="Mi perfil"
        description="Actualiza tus datos personales y tu contraseña."
      />
      <div className="mt-6">
        <ProfileForm
          email={user!.email ?? ''}
          initialData={{
            fullName: profile?.full_name ?? '',
            phone: profile?.phone ?? '',
          }}
          showPasswordChange
        />
      </div>
    </PageContainer>
  )
}
