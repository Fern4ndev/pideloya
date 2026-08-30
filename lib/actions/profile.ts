'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/db/server'
import {
  profileUpdateSchema,
  type ProfileUpdateInput,
} from '@/lib/validations/profile'

function toFriendlyMessage(err: unknown): string {
  if (err instanceof z.ZodError) {
    return err.issues.map((issue) => issue.message).join(' ')
  }
  if (err instanceof Error) return err.message
  return 'Algo salió mal'
}

/**
 * Actualiza los datos propios del perfil. Solo toca full_name, phone y
 * los campos específicos de repartidor — nunca role ni is_active, que
 * además están bloqueados a nivel de columna (ver migración 0010) como
 * segunda capa de protección.
 */
export async function updateProfile(input: ProfileUpdateInput) {
  let data: ProfileUpdateInput
  try {
    data = profileUpdateSchema.parse(input)
  } catch (err) {
    throw new Error(toFriendlyMessage(err))
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('No autenticado')

  const updates: {
    full_name: string
    phone: string | null
    document_type?: string | null
    document_number?: string | null
    vehicle_type?: string | null
  } = {
    full_name: data.fullName,
    phone: data.phone || null,
  }
  if (data.documentType !== undefined) {
    updates.document_type = data.documentType || null
  }
  if (data.documentNumber !== undefined) {
    updates.document_number = data.documentNumber || null
  }
  if (data.vehicleType !== undefined) {
    updates.vehicle_type = data.vehicleType || null
  }

  const { error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('auth_id', user.id)

  if (error) throw new Error(error.message)

  revalidatePath('/cliente/perfil')
  revalidatePath('/restaurante/perfil')
  revalidatePath('/repartidor/perfil')
  revalidatePath('/admin/perfil')
  return { success: true }
}

const passwordSchema = z.string().min(8, 'Mínimo 8 caracteres')

export async function changePassword(newPassword: string) {
  let password: string
  try {
    password = passwordSchema.parse(newPassword)
  } catch (err) {
    throw new Error(toFriendlyMessage(err))
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.updateUser({ password })
  if (error) throw new Error(error.message)

  return { success: true }
}