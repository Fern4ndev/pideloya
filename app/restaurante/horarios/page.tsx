import { redirect } from 'next/navigation'
import { createClient } from '@/lib/db/server'
import { RestaurantHoursForm } from '@/components/features/restaurants/RestaurantHoursForm'

export default async function HorariosPage() {
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

  const { data: hours } = await supabase
    .from('restaurant_hours')
    .select('day_of_week, open_time, close_time, is_closed')
    .eq('restaurant_id', member.restaurant_id)
    .order('day_of_week')

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Horarios</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Define los horarios de atención de tu restaurante.
      </p>
      <div className="mt-6">
        <RestaurantHoursForm initialHours={hours ?? []} />
      </div>
    </div>
  )
}
