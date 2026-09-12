import { createClient } from '@/lib/db/server'
import { BusinessInfoForm } from '@/components/features/restaurants/BusinessInfoForm'
import { LogoUploader } from '@/components/features/restaurants/LogoUploader'
import { PageHeader } from '@/components/layout/PageHeader'
import { PageContainer } from '@/components/layout/PageContainer'
import { Card, CardContent } from '@/components/ui/card'

export default async function BusinessInfoPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('auth_id', user!.id)
    .single()

  const { data: member } = await supabase
    .from('restaurant_members')
    .select('restaurant_id')
    .eq('user_id', profile!.id)
    .single()

  const { data: restaurant } = await supabase
    .from('restaurants')
    .select(
      'name, description, address_text, whatsapp, food_type, is_active, logo_url'
    )
    .eq('id', member!.restaurant_id)
    .single()

  return (
    <PageContainer size="sm">
      <PageHeader
        title="Mi negocio"
        description="Esta información aparece en tu carta pública."
      />

      <Card className="mt-6">
        <CardContent className="space-y-8">
          <div className="border-b pb-6">
            <LogoUploader
              currentLogoUrl={restaurant?.logo_url ?? null}
              restaurantId={member!.restaurant_id}
            />
          </div>

          <BusinessInfoForm
            initialData={{
              name: restaurant?.name ?? '',
              description: restaurant?.description ?? '',
              addressText: restaurant?.address_text ?? '',
              whatsapp: restaurant?.whatsapp ?? '',
              foodType: restaurant?.food_type ?? '',
              isActive: restaurant?.is_active ?? true,
            }}
          />
        </CardContent>
      </Card>
    </PageContainer>
  )
}