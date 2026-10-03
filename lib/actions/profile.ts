'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/db/server'
import { deleteImageKitFileSafe } from '@/lib/imagekit-server'
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
 * Cliente + usuario autenticado, para todo lo que escribe en el perfil.
 *
 * Se usa el cliente normal (respeta RLS), nunca service_role: el propio
 * usuario editando su propia fila es exactamente el caso que ya cubre la
 * policy `profiles_update_own`.
 *
 * El authId SIEMPRE sale de la sesión de cookies, nunca de un argumento
 * que mande el cliente.
 */
async function getCurrentAuthUser() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('No autenticado')
  return { supabase, authId: user.id }
}

// El par url+fileId lo produce el cliente al subir a ImageKit, y una Server
// Action es un endpoint HTTP público: cualquiera puede invocarla con el
// payload que quiera. Se valida la forma antes de escribir en la base —
// sin esto, un string cualquiera terminaría renderizado como <img src>
// roto. Se exige https porque es lo único que devuelve ImageKit.
const uploadedImageSchema = z.object({
  url: z.string().regex(/^https:\/\//, 'URL de imagen inválida'),
  fileId: z.string().min(1, 'fileId de imagen inválido'),
})

type UploadedImageInput = z.infer<typeof uploadedImageSchema>

function parseUploadedImage(image: UploadedImageInput): UploadedImageInput {
  try {
    return uploadedImageSchema.parse(image)
  } catch (err) {
    throw new Error(toFriendlyMessage(err))
  }
}

/**
 * Guarda o reemplaza la foto de perfil del usuario autenticado.
 *
 * Genérica a propósito: las columnas `avatar_*` viven en `profiles` para
 * cualquier rol, así que la acción no valida rol — hoy solo la UI de
 * repartidor la expone.
 */
export async function saveAvatar(image: UploadedImageInput) {
  const { url, fileId } = parseUploadedImage(image)
  const { supabase, authId } = await getCurrentAuthUser()

  const { data: current } = await supabase
    .from('profiles')
    .select('avatar_file_id')
    .eq('auth_id', authId)
    .single()

  const { error } = await supabase
    .from('profiles')
    .update({ avatar_url: url, avatar_file_id: fileId })
    .eq('auth_id', authId)

  if (error) throw new Error(error.message)

  // El archivo ANTERIOR se borra DESPUÉS de guardar el nuevo con éxito —
  // mismo orden y misma razón que saveRestaurantLogo(): si el borrado
  // falla, el usuario igual se queda con su foto nueva, en vez de quedar
  // sin foto por un error de limpieza.
  await deleteImageKitFileSafe(current?.avatar_file_id)

  revalidatePath('/repartidor/perfil')
  return { success: true }
}

export async function removeAvatar() {
  const { supabase, authId } = await getCurrentAuthUser()

  const { data: current } = await supabase
    .from('profiles')
    .select('avatar_file_id')
    .eq('auth_id', authId)
    .single()

  const { error } = await supabase
    .from('profiles')
    .update({ avatar_url: null, avatar_file_id: null })
    .eq('auth_id', authId)

  if (error) throw new Error(error.message)

  await deleteImageKitFileSafe(current?.avatar_file_id)

  revalidatePath('/repartidor/perfil')
  return { success: true }
}

/**
 * Guarda o reemplaza el QR de Yape del repartidor autenticado.
 *
 * A diferencia de saveAvatar, SÍ valida el rol en el servidor: el QR solo
 * tiene sentido de negocio para DELIVERY (cobra directo al cliente), pero
 * la policy RLS no distingue por columna, así que "el botón no se muestra
 * a un CUSTOMER" no es suficiente — cualquiera podría invocar la action
 * desde DevTools y guardarse un yape_qr_url.
 */
export async function saveYapeQr(image: UploadedImageInput) {
  const { url, fileId } = parseUploadedImage(image)
  const { supabase, authId } = await getCurrentAuthUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, yape_qr_file_id')
    .eq('auth_id', authId)
    .single()

  if (profile?.role !== 'DELIVERY') {
    throw new Error('Solo los repartidores pueden subir un QR de Yape')
  }

  const { error } = await supabase
    .from('profiles')
    .update({ yape_qr_url: url, yape_qr_file_id: fileId })
    .eq('auth_id', authId)

  if (error) throw new Error(error.message)

  await deleteImageKitFileSafe(profile?.yape_qr_file_id)

  revalidatePath('/repartidor/perfil')
  return { success: true }
}

export async function removeYapeQr() {
  const { supabase, authId } = await getCurrentAuthUser()

  const { data: current } = await supabase
    .from('profiles')
    .select('yape_qr_file_id')
    .eq('auth_id', authId)
    .single()

  const { error } = await supabase
    .from('profiles')
    .update({ yape_qr_url: null, yape_qr_file_id: null })
    .eq('auth_id', authId)

  if (error) throw new Error(error.message)

  await deleteImageKitFileSafe(current?.yape_qr_file_id)

  revalidatePath('/repartidor/perfil')
  return { success: true }
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

const acceptsPayOnDeliverySchema = z.boolean()

/**
 * Interruptor D7 (Fase 7): ¿acepta el repartidor que el cliente pague al
 * recibir, adelantando él la comida de su dinero?
 *
 * Valida el rol en el servidor por el mismo motivo que saveYapeQr: la policy
 * RLS permite al usuario escribir su propia fila, pero no distingue columnas,
 * así que "el interruptor solo se muestra al repartidor" no impide que un
 * cliente lo invoque desde DevTools y se ponga el flag (hoy inocuo, pero el
 * dato es de negocio del repartidor y no debe poder falsearse desde otro rol).
 *
 * No revalida rutas de reparto: el snapshot ya enviado vive en
 * `deliveries.allows_pay_on_delivery` y NO depende de este valor (ver la
 * migración 20261002100400). El cambio solo afecta ofertas futuras.
 */
export async function setAcceptsPayOnDelivery(accepts: boolean) {
  let value: boolean
  try {
    value = acceptsPayOnDeliverySchema.parse(accepts)
  } catch (err) {
    throw new Error(toFriendlyMessage(err))
  }

  const { supabase, authId } = await getCurrentAuthUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('auth_id', authId)
    .single()

  if (profile?.role !== 'DELIVERY') {
    throw new Error('Solo los repartidores pueden cambiar esta preferencia')
  }

  const { error } = await supabase
    .from('profiles')
    .update({ accepts_pay_on_delivery: value })
    .eq('auth_id', authId)

  if (error) throw new Error(error.message)

  revalidatePath('/repartidor/perfil')
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