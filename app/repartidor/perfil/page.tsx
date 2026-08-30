import { createClient } from '@/lib/db/server'
import { ProfileForm } from '@/components/features/profile/ProfileForm'

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
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Mi perfil</h1>
      <div className="mt-6">
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
      </div>
    </div>
  )
}