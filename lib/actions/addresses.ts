'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/db/server'
import { getMyProfileId } from '@/lib/auth/session'
import { addressSchema, type AddressInput } from '@/lib/validations/address'

// La cadena de identidad (getUser + profiles) vive en lib/auth/session.ts
// con cache() de React: 1 vez por request en vez de 2 consultas por action.

export async function createAddress(input: AddressInput) {
  const data = addressSchema.parse(input)
  const profileId = await getMyProfileId()
  const supabase = await createClient()

  // Regla de negocio: un cliente solo puede tener UNA dirección guardada.
  // Este chequeo evita el viaje redondo cuando ya sabemos que existe una;
  // el constraint único en la base (migración 20260920210000) es la red
  // de seguridad real ante condiciones de carrera.
  const { count } = await supabase
    .from('addresses')
    .select('id', { count: 'exact', head: true })
    .eq('customer_id', profileId)

  if (count && count > 0) {
    throw new Error(
      'Ya tienes una dirección guardada. Edítala o elimínala antes de agregar otra.'
    )
  }

  const { error } = await supabase.from('addresses').insert({
    customer_id: profileId,
    label: data.label || null,
    address_text: data.addressText,
    reference: data.reference || null,
    latitude: data.latitude,
    longitude: data.longitude,
  })

  if (error) {
    if (error.code === '23505') {
      throw new Error('Ya tienes una dirección guardada.')
    }
    throw new Error(error.message)
  }

  revalidatePath('/cliente/direcciones')
  revalidatePath('/cliente/carrito')
  return { success: true }
}

export async function updateAddress(addressId: string, input: AddressInput) {
  const data = addressSchema.parse(input)
  const supabase = await createClient()

  // RLS "addresses_update_own" ya garantiza que solo el dueño puede
  // tocar su dirección — el update falla silenciosamente si no le
  // pertenece, así que verificamos con select().single().
  const { data: updated, error } = await supabase
    .from('addresses')
    .update({
      label: data.label || null,
      address_text: data.addressText,
      reference: data.reference || null,
      latitude: data.latitude,
      longitude: data.longitude,
    })
    .eq('id', addressId)
    .select('id')
    .single()

  if (error || !updated) throw new Error('No se pudo actualizar la dirección')

  revalidatePath('/cliente/direcciones')
  revalidatePath('/cliente/carrito')
  return { success: true }
}

export async function deleteAddress(addressId: string) {
  const supabase = await createClient()

  const { error } = await supabase.from('addresses').delete().eq('id', addressId)
  if (error) throw new Error(error.message)

  revalidatePath('/cliente/direcciones')
  revalidatePath('/cliente/carrito')
  return { success: true }
}