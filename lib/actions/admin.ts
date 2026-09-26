'use server'

import { revalidatePath } from 'next/cache'
import { createClient, createServiceRoleClient } from '@/lib/db/server'
import { removeRestaurant } from '@/lib/admin/remove-restaurant'
import {
  getActiveDelivery,
  releaseActiveDeliveries,
} from '@/lib/admin/delivery-lifecycle'
import { hasTransactionalHistory } from '@/lib/admin/has-transactional-history'
import { anonymizeProfile } from '@/lib/admin/anonymize-profile'
import { logAdminAction, AUDIT_ACTIONS } from '@/lib/admin/audit-log'

// Ban "permanente" de Supabase GoTrue: ~100 años en horas. Mantiene la
// fila de auth.users (necesaria para conservar pedidos/deliveries con
// historial) pero bloquea cualquier inicio de sesión. La duración exacta
// es irrelevante mientras supere la vida útil del sistema; se documenta
// la elección en decisions-and-learnings.md porque el comportamiento de
// ban_duration puede variar entre versiones del SDK.
const PERMANENT_BAN = '876000h'

/**
 * Valida rol ADMIN y devuelve el profileId del actor: las acciones lo
 * necesitan para firmar su entrada en admin_audit_log (Fase 6). Antes
 * solo validaba el rol y descartaba el resultado.
 */
async function assertIsAdmin(): Promise<string> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('No autenticado')

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role')
    .eq('auth_id', user.id)
    .single()

  if (profile?.role !== 'ADMIN') {
    throw new Error('Solo el administrador puede realizar esta acción')
  }

  return profile.id
}

export async function approveRestaurant(restaurantId: string) {
  const actorProfileId = await assertIsAdmin()
  const adminClient = createServiceRoleClient()

  // Sirve para aprobar (pendiente) y reactivar (soft-deadeado):
  // restaura ambos flags y reactiva a los miembros.
  const { error } = await adminClient
    .from('restaurants')
    .update({ is_approved: true, is_active: true })
    .eq('id', restaurantId)

  if (error) throw new Error(error.message)

  const { data: members } = await adminClient
    .from('restaurant_members')
    .select('user_id')
    .eq('restaurant_id', restaurantId)

  if (members && members.length > 0) {
    await adminClient
      .from('profiles')
      .update({ is_active: true })
      .in('id', members.map((m) => m.user_id))
  }

  // Auditoría (Fase 6): al final, con la acción ya ejecutada. Best-effort:
  // un fallo del log no revierte la aprobación.
  await logAdminAction(adminClient, {
    actorProfileId,
    action: AUDIT_ACTIONS.approveRestaurant,
    targetTable: 'restaurants',
    targetId: restaurantId,
  })

  revalidatePath('/admin/restaurantes')
  revalidatePath('/admin')
  return { success: true, message: 'Restaurante activado' }
}

/**
 * Aprobación EN LOTE de restaurantes (Fase 8). Un solo update .in() con
 * la misma lógica que approveRestaurant (restaura ambos flags + reactiva
 * a los miembros). Devuelve cuántos se procesaron: si una fila ya no
 * existe (otro admin la eliminó concurrentemente), el update simplemente
 * no la alcanza — la operación NO es todo-o-nada silencioso, el mensaje
 * reporta el total afectado.
 *
 * Auditoría: UNA SOLA entrada por lote con metadata.batchIds (no N
 * idénticas — criterio del plan).
 */
export async function approveRestaurantsBulk(ids: string[]) {
  const actorProfileId = await assertIsAdmin()
  const adminClient = createServiceRoleClient()

  const batchIds = [...new Set(ids)].filter((id) => id.length > 0)
  if (batchIds.length === 0) {
    return { success: false, message: 'No hay restaurantes seleccionados' }
  }

  const { data: approved, error } = await adminClient
    .from('restaurants')
    .update({ is_approved: true, is_active: true })
    .in('id', batchIds)
    .select('id')

  if (error) throw new Error(error.message)
  const affected = (approved ?? []).map((r) => r.id)

  if (affected.length > 0) {
    // Reactivar a los miembros de cada restaurante aprobado (mismo efecto
    // que approveRestaurant individual).
    const { data: members } = await adminClient
      .from('restaurant_members')
      .select('user_id')
      .in('restaurant_id', affected)

    const memberIds = [...new Set((members ?? []).map((m) => m.user_id))]
    if (memberIds.length > 0) {
      await adminClient
        .from('profiles')
        .update({ is_active: true })
        .in('id', memberIds)
    }
  }

  if (affected.length > 0) {
    await logAdminAction(adminClient, {
      actorProfileId,
      action: AUDIT_ACTIONS.approveRestaurantsBulk,
      targetTable: 'restaurants',
      targetId: null,
      metadata: { batchIds: affected },
    })
  }

  revalidatePath('/admin/restaurantes')
  revalidatePath('/admin')

  return {
    success: true,
    message:
      affected.length === batchIds.length
        ? `${affected.length} restaurante(s) activado(s)`
        : `${affected.length} de ${batchIds.length} activado(s). El resto ya no existe o fue procesado por otro admin.`,
  }
}

/**
 * Aprobación EN LOTE de repartidores (Fase 8): mismo patrón que
 * approveRestaurantsBulk, un solo update .in(). Solo alcanza filas
 * existentes con rol DELIVERY (la edición de rol es privilegio exclusivo
 * del flujo normal, no de un update masivo).
 */
export async function approveDeliveriesBulk(ids: string[]) {
  const actorProfileId = await assertIsAdmin()
  const adminClient = createServiceRoleClient()

  const batchIds = [...new Set(ids)].filter((id) => id.length > 0)
  if (batchIds.length === 0) {
    return { success: false, message: 'No hay repartidores seleccionados' }
  }

  const { data: approved, error } = await adminClient
    .from('profiles')
    .update({ is_active: true })
    .in('id', batchIds)
    .eq('role', 'DELIVERY')
    .select('id')

  if (error) throw new Error(error.message)
  const affected = (approved ?? []).map((r) => r.id)

  if (affected.length > 0) {
    await logAdminAction(adminClient, {
      actorProfileId,
      action: AUDIT_ACTIONS.approveDeliveriesBulk,
      targetTable: 'profiles',
      targetId: null,
      metadata: { batchIds: affected },
    })
  }

  revalidatePath('/admin/repartidores')
  revalidatePath('/admin')

  return {
    success: true,
    message:
      affected.length === batchIds.length
        ? `${affected.length} repartidor(es) activado(s)`
        : `${affected.length} de ${batchIds.length} activado(s). El resto ya no existe o fue procesado por otro admin.`,
  }
}

export async function approveDeliveryPerson(profileId: string) {
  const actorProfileId = await assertIsAdmin()
  const adminClient = createServiceRoleClient()

  const { error } = await adminClient
    .from('profiles')
    .update({ is_active: true })
    .eq('id', profileId)

  if (error) throw new Error(error.message)

  await logAdminAction(adminClient, {
    actorProfileId,
    action: AUDIT_ACTIONS.approveDeliveryPerson,
    targetTable: 'profiles',
    targetId: profileId,
  })

  revalidatePath('/admin/repartidores')
  revalidatePath('/admin')
  return { success: true, message: 'Repartidor activado' }
}

export async function deleteRestaurant(restaurantId: string) {
  const actorProfileId = await assertIsAdmin()
  const adminClient = createServiceRoleClient()

  // Híbrido compartido con DELETE /api/v1/restaurants/[id]: soft delete
  // si tiene pedidos, hard delete si no (ver lib/admin/remove-restaurant).
  const result = await removeRestaurant(adminClient, restaurantId)

  // metadata.softDeleted distingue el híbrido soft/hard en la auditoría.
  await logAdminAction(adminClient, {
    actorProfileId,
    action: AUDIT_ACTIONS.deleteRestaurant,
    targetTable: 'restaurants',
    targetId: restaurantId,
    metadata: { softDeleted: result.softDeleted },
  })

  revalidatePath('/admin/restaurantes')
  revalidatePath('/admin')
  return result
}

export async function deactivateUser(profileId: string) {
  const actorProfileId = await assertIsAdmin()
  const adminClient = createServiceRoleClient()

  // Guarda: un repartidor con entrega en curso no se puede desactivar.
  // Si se permitiera, el pedido quedaría colgado en tracking eterno para
  // el cliente e inasignable para otros repartidores (delivery_person_id
  // = null no vuelve al pool). El Error se muestra como toast de error
  // en la UI (ConfirmDialog muestra err.message).
  const { data: profile } = await adminClient
    .from('profiles')
    .select('id, role')
    .eq('id', profileId)
    .single()

  if (!profile) throw new Error('Perfil no encontrado')

  if (profile.role === 'DELIVERY') {
    const activeDelivery = await getActiveDelivery(adminClient, profileId)
    if (activeDelivery) {
      throw new Error(
        `Este repartidor tiene una entrega en curso (pedido #${activeDelivery.order_id.slice(0, 8)}). Complétala o reasígnala antes de desactivarlo.`
      )
    }
  }

  const { error } = await adminClient
    .from('profiles')
    .update({ is_active: false })
    .eq('id', profileId)

  if (error) throw new Error(error.message)

  await logAdminAction(adminClient, {
    actorProfileId,
    action: AUDIT_ACTIONS.deactivateUser,
    targetTable: 'profiles',
    targetId: profileId,
    metadata: { role: profile.role },
  })

  revalidatePath('/admin/usuarios')
  revalidatePath('/admin/repartidores')
  revalidatePath('/admin')
  return { success: true, message: 'Usuario desactivado' }
}

export async function updateRestaurant(
  restaurantId: string,
  data: { name?: string; food_type?: string; whatsapp?: string; address_text?: string }
) {
  const actorProfileId = await assertIsAdmin()
  const adminClient = createServiceRoleClient()

  // Valores previos para la auditoría: la entrada del log debe permitir
  // responder "¿qué había antes del cambio?" sin depender de backups.
  const { data: previous } = await adminClient
    .from('restaurants')
    .select('name, food_type, whatsapp, address_text')
    .eq('id', restaurantId)
    .single()

  const { error } = await adminClient
    .from('restaurants')
    .update(data)
    .eq('id', restaurantId)

  if (error) throw new Error(error.message)

  await logAdminAction(adminClient, {
    actorProfileId,
    action: AUDIT_ACTIONS.updateRestaurant,
    targetTable: 'restaurants',
    targetId: restaurantId,
    metadata: { previous, changes: data },
  })

  revalidatePath('/admin/restaurantes')
  return { success: true }
}

export async function updateDeliveryPerson(
  profileId: string,
  data: { full_name?: string; phone?: string; document_type?: string; document_number?: string; vehicle_type?: string }
) {
  const actorProfileId = await assertIsAdmin()
  const adminClient = createServiceRoleClient()

  const { data: previous } = await adminClient
    .from('profiles')
    .select('full_name, phone, document_type, document_number, vehicle_type')
    .eq('id', profileId)
    .single()

  const { error } = await adminClient
    .from('profiles')
    .update(data)
    .eq('id', profileId)

  if (error) throw new Error(error.message)

  await logAdminAction(adminClient, {
    actorProfileId,
    action: AUDIT_ACTIONS.updateDeliveryPerson,
    targetTable: 'profiles',
    targetId: profileId,
    metadata: { previous, changes: data },
  })

  revalidatePath('/admin/repartidores')
  return { success: true }
}

export async function deleteUser(profileId: string) {
  const actorProfileId = await assertIsAdmin()
  const adminClient = createServiceRoleClient()

  const { data: profile } = await adminClient
    .from('profiles')
    .select('auth_id, role, is_active')
    .eq('id', profileId)
    .single()

  if (!profile) throw new Error('Perfil no encontrado')

  // Política unificada de borrado (Fase 3 del plan):
  //   - CON historial transaccional: NUNCA se purga de auth.users. Se
  //     anonimiza la PII viva, se desactiva el perfil y se banea el login
  //     en Supabase Auth (la fila de auth queda, pero sin acceso). Los
  //     pedidos/deliveries conservan su evidencia con customer_id/
  //     delivery_person_id apuntando a un perfil anonimizado.
  //   - SIN historial: hard delete completo (comportamiento legacy).
  const hasHistory = await hasTransactionalHistory(adminClient, {
    role: profile.role as 'CUSTOMER' | 'DELIVERY',
    profileId,
  })

  if (hasHistory) {
    // 1) Anonimiza la PII editable del perfil y sus direcciones. Los
    // snapshots de orders (customer_name/customer_phone) NO se tocan:
    // son registro histórico "al momento del pedido".
    await anonymizeProfile(adminClient, profileId)

    // 2) Desactiva el perfil (sale de los listados activos del admin).
    const { error: deactivateError } = await adminClient
      .from('profiles')
      .update({ is_active: false })
      .eq('id', profileId)
    if (deactivateError) throw new Error(deactivateError.message)

    // 3) Revoca el login sin borrar la fila de auth.users.
    if (profile.auth_id) {
      const { error: banError } = await adminClient.auth.admin.updateUserById(
        profile.auth_id as string,
        { ban_duration: PERMANENT_BAN }
      )
      if (banError) throw new Error(banError.message)
    }

    revalidatePath('/admin/usuarios')
    revalidatePath('/admin/repartidores')
    revalidatePath('/admin')

    // Auditoría: el log sobrevive al usuario eliminado (actor es SET NULL
    // on delete; el target es un perfil anonimizado, no borrado).
    await logAdminAction(adminClient, {
      actorProfileId,
      action: AUDIT_ACTIONS.deleteUserAnonymize,
      targetTable: 'profiles',
      targetId: profileId,
      metadata: { role: profile.role, hasHistory },
    })

    return {
      success: true,
      message:
        'Cuenta desactivada y anonimizada. Conserva su historial de pedidos como evidencia y no puede iniciar sesión.',
    }
  }

  // Liberación defensiva: si es repartidor, devolver al pool (PENDING)
  // sus pedidos activos ANTES de purgar la cuenta. El borrado de auth
  // aplica ON DELETE SET NULL en deliveries.delivery_person_id
  // (20260923100000): sin esta liberación, el pedido quedaría huérfano
  // sin persona para siempre. También cubre pedidos colgados legacy de
  // desactivaciones anteriores a la guarda de deactivateUser().
  let releasedOrders = 0
  if (profile.role === 'DELIVERY') {
    releasedOrders = await releaseActiveDeliveries(adminClient, profileId)
  }

  // Se borra PRIMERO la cuenta de auth: el FK profiles.auth_id →
  // auth.users es "on delete cascade", así que Postgres purga el perfil
  // en la misma operación (atómica: si el cascade fallara, la cuenta queda
  // intacta y no queda un auth sin perfil). Los pedidos se conservan con
  // customer_id = null (migración orders_customer_set_null).
  if (profile.auth_id) {
    const { error: authError } =
      await adminClient.auth.admin.deleteUser(profile.auth_id as string)
    if (authError) throw new Error(authError.message)
  } else {
    const { error: deleteError } = await adminClient
      .from('profiles')
      .delete()
      .eq('id', profileId)
    if (deleteError) throw new Error(deleteError.message)
  }

  revalidatePath('/admin/usuarios')
  revalidatePath('/admin/repartidores')
  revalidatePath('/admin')

  await logAdminAction(adminClient, {
    actorProfileId,
    action: AUDIT_ACTIONS.deleteUserHard,
    targetTable: 'profiles',
    targetId: profileId,
    metadata: { role: profile.role, hasHistory: false, releasedOrders },
  })

  return {
    success: true,
    message:
      releasedOrders > 0
        ? `Cuenta eliminada. Se liberaron ${releasedOrders} pedido(s) que estaban asignados a este repartidor.`
        : undefined,
  }
}