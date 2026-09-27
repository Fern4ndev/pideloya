import { createClient } from '@/lib/db/server'
import { ProfileForm } from '@/components/features/profile/ProfileForm'
import { AvatarUploader } from '@/components/features/profile/AvatarUploader'
import { YapeQrUploader } from '@/components/features/profile/YapeQrUploader'
import { PasswordChangeForm } from '@/components/features/profile/PasswordChangeForm'
import { PageHeader } from '@/components/layout/PageHeader'
import { PageContainer } from '@/components/layout/PageContainer'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ImageIcon, QrCodeIcon, ShieldCheckIcon, UserIcon } from 'lucide-react'

export default async function RepartidorProfilePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select(
      'id, full_name, phone, document_type, document_number, vehicle_type, avatar_url, yape_qr_url'
    )
    .eq('auth_id', user!.id)
    .single()

  return (
    <PageContainer size="sm">
      <PageHeader
        title="Mi perfil"
        description="Tus datos personales, tu foto y cómo te pagan tus clientes."
      />

      <div className="mt-6 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ImageIcon className="size-4 text-muted-foreground" />
              Foto de perfil
            </CardTitle>
          </CardHeader>
          <CardContent>
            <AvatarUploader
              profileId={profile!.id}
              currentAvatarUrl={profile?.avatar_url ?? null}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <UserIcon className="size-4 text-muted-foreground" />
              Datos personales
            </CardTitle>
          </CardHeader>
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
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <QrCodeIcon className="size-4 text-muted-foreground" />
              Cobro por Yape
            </CardTitle>
          </CardHeader>
          <CardContent>
            <YapeQrUploader
              profileId={profile!.id}
              currentYapeQrUrl={profile?.yape_qr_url ?? null}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheckIcon className="size-4 text-muted-foreground" />
              Seguridad
            </CardTitle>
          </CardHeader>
          <CardContent>
            <PasswordChangeForm />
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  )
}
