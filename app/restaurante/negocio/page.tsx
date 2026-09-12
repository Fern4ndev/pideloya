import { redirect } from 'next/navigation'
import { createClient } from '@/lib/db/server'
import { RestaurantInfoForm } from '@/components/features/restaurants/RestaurantInfoForm'

export default async function NegocioPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('auth_id', user.id)
    .single()

  if (!profile) redirect('/login')

  const { data: member } = await supabase
    .from('restaurant_members')
    .select('restaurant_id')
    .eq('user_id', profile.id)
    .single()

  if (!member) redirect('/restaurante')

  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('name, description, address_text, whatsapp, food_type')
    .eq('id', member.restaurant_id)
    .single()

  if (!restaurant) redirect('/restaurante')

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Mi negocio</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Administra la información pública de tu restaurante.
      </p>
      <div className="mt-6">
        <RestaurantInfoForm
          initialData={{
            name: restaurant.name,
            description: restaurant.description,
            addressText: restaurant.address_text,
            whatsapp: restaurant.whatsapp,
            foodType: restaurant.food_type,
          }}
        />
      </div>
    </div>
  )
}
