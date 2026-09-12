import { createClient } from '@/lib/db/server'
import { ProfileForm } from '@/components/features/profile/ProfileForm'
import { PageHeader } from '@/components/layout/PageHeader'
import { PageContainer } from '@/components/layout/PageContainer'
import { Card, CardContent } from '@/components/ui/card'

export default async function RestauranteProfilePage() {
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
        description="Tus datos personales como responsable de la cuenta. Para editar la información del negocio, ve a Mi negocio."
      />

      <Card className="mt-6">
        <CardContent>
          <ProfileForm
            email={user!.email ?? ''}
            initialData={{
              fullName: profile?.full_name ?? '',
              phone: profile?.phone ?? '',
            }}
            showPasswordChange
          />
        </CardContent>
      </Card>
    </PageContainer>
  )
}