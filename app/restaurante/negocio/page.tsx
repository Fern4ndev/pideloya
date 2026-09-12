import { createClient } from '@/lib/db/server'
import { BusinessInfoForm } from '@/components/features/restaurants/BusinessInfoForm'
import { LogoUploader } from '@/components/features/restaurants/LogoUploader'

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
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Mi negocio</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Esta información aparece en tu carta pública.
      </p>

      <div className="mt-6 max-w-md space-y-8">
        <LogoUploader
          currentLogoUrl={restaurant?.logo_url ?? null}
          restaurantId={member!.restaurant_id}
        />
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
      </div>
    </div>
  )
}