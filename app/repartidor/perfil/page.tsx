import { createClient } from '@/lib/db/server'
import { ProfileForm } from '@/components/features/profile/ProfileForm'
import { PageHeader } from '@/components/layout/PageHeader'
import { PageContainer } from '@/components/layout/PageContainer'
import { Card, CardContent } from '@/components/ui/card'

export default async function RepartidorProfilePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, phone, document_type, document_number, vehicle_type')
    .eq('auth_id', user!.id)
    .single()

  return (
    <PageContainer size="sm">
      <PageHeader
        title="Mi perfil"
        description="Tus datos personales y de repartidor."
      />

      <Card className="mt-6">
        <CardContent>
          <ProfileForm
            email={user!.email ?? ''}
            initialData={{
              fullName: profile?.full_name ?? '',
              phone: profile?.phone ?? '',
              documentType: profile?.document_type ?? '',
              documentNumber: profile?.document_number ?? '',
              vehicleType: profile?.vehicle_type ?? '',
            }}
            showDeliveryFields
            showPasswordChange
          />
        </CardContent>
      </Card>
    </PageContainer>
  )
}