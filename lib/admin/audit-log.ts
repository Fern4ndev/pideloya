import type { createServiceRoleClient } from '@/lib/db/server'

type AdminClient = ReturnType<typeof createServiceRoleClient>

/**
 * Catálogo de acciones que escribe el panel admin. Sirve de documentación
 * viva (la página de auditoría lista estas claves como filtro) y evita
 * typos entre call sites: cada acción usa su constante, no un string suelto.
 */
export const AUDIT_ACTIONS = {
  approveRestaurant: 'approve_restaurant',
  approveDeliveryPerson: 'approve_delivery_person',
  deleteRestaurant: 'delete_restaurant',
  deactivateUser: 'deactivate_user',
  updateRestaurant: 'edit_restaurant',
  updateDeliveryPerson: 'edit_delivery_person',
  deleteUserAnonymize: 'anonymize_user',
  deleteUserHard: 'hard_delete_user',
  approveRestaurantsBulk: 'approve_restaurants_bulk',
  approveDeliveriesBulk: 'approve_deliveries_bulk',
} as const

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS]

/**
 * Registra una acción administrativa en admin_audit_log. BEST-EFFORT a
 * propósito: un fallo al loguear NUNCA debe revertir ni bloquear la
 * acción real que ya se ejecutó (aprobar, desactivar, etc.) — se registra
 * el error y se continúa, igual que deleteImageKitFileSafe. La acción
 * principal devuelve su resultado normal aunque el log haya fallado.
 *
 * Se llama SIEMPRE al final de la acción (después del update/delete que
 * ya tuvo éxito), nunca antes: el log declara un hecho ocurrido.
 */
export async function logAdminAction(
  client: AdminClient,
  params: {
    actorProfileId: string
    action: AuditAction
    targetTable: 'restaurants' | 'profiles'
    /** null en acciones EN LOTE: los ids afectados van en
     * metadata.batchIds — UNA entrada por lote, no N idénticas. */
    targetId: string | null
    metadata?: Record<string, unknown>
  }
): Promise<void> {
  const { error } = await client.from('admin_audit_log').insert({
    actor_profile_id: params.actorProfileId,
    action: params.action,
    target_table: params.targetTable,
    target_id: params.targetId,
    // Json de supabase-js acepta objetos con claves string, pero
    // Record<string, unknown> es más ancho que Json: el cast hace el
    // contrato explícito (los callers pasan metadata serializable).
    metadata: (params.metadata ?? null) as never,
  })
  if (error) {
    console.error('[audit-log] no se pudo registrar la acción:', {
      action: params.action,
      targetTable: params.targetTable,
      targetId: params.targetId,
      error: error.message,
    })
  }
}
