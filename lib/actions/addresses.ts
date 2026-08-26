'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/db/server'
import { addressSchema, type AddressInput } from '@/lib/validations/address'

export async function createAddress(input: AddressInput) {
  const data = addressSchema.parse(input)
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('No autenticado')

  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('auth_id', user.id)
    .single()

  if (!profile) throw new Error('Perfil no encontrado')

  // La policy RLS "addresses_insert_own" ya exige que customer_id
  // coincida con el usuario autenticado — esto es solo para tenerlo
  // a mano al construir el insert.
  const { error } = await supabase.from('addresses').insert({
    customer_id: profile.id,
    label: data.label || null,
    address_text: data.addressText,
    reference: data.reference || null,
    latitude: data.latitude,
    longitude: data.longitude,
  })

  if (error) throw new Error(error.message)

  revalidatePath('/cliente/direcciones')
  return { success: true }
}

export async function deleteAddress(addressId: string) {
  const supabase = await createClient()

  const { error } = await supabase.from('addresses').delete().eq('id', addressId)

  if (error) throw new Error(error.message)

  revalidatePath('/cliente/direcciones')
  return { success: true }
}