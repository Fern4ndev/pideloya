import type { createServiceRoleClient } from '@/lib/db/server'

type AdminClient = ReturnType<typeof createServiceRoleClient>

export type HistoryCheck =
  | { role: 'CUSTOMER'; profileId: string }
  | { role: 'DELIVERY'; profileId: string }

/**
 * ¿Tiene la cuenta historial transaccional? Es la pieza central de la
 * política de borrado (Fase 3 del plan de eliminación de cuentas):
 *
 *   - CON historial  → la cuenta NUNCA se purga de auth.users: se
 *     desactiva, se anonimiza su PII y se revoca el login. Los pedidos /
 *     entregas conservan su evidencia (Ley 29733: dato transaccional se
 *     conserva; dato personal identificable se elimina).
 *   - SIN historial  → hard delete completo (comportamiento legacy).
 *
 * Limit 1 + maybeSingle: solo importa la EXISTENCIA de al menos una
 * fila; no traemos el historial entero para contar.
 */
export async function hasTransactionalHistory(
  client: AdminClient,
  check: HistoryCheck
): Promise<boolean> {
  if (check.role === 'CUSTOMER') {
    // Cualquier pedido hecho por el cliente cuenta, esté o no cancelado:
    // es evidencia transaccional (monto, fecha, snapshot del cliente).
    const { data } = await client
      .from('orders')
      .select('id')
      .eq('customer_id', check.profileId)
      .limit(1)
      .maybeSingle()
    return !!data
  }

  // DELIVERY: cualquier fila en deliveries (activa, entregada o
  // cancelada) es evidencia de trabajo.
  const { data } = await client
    .from('deliveries')
    .select('id')
    .eq('delivery_person_id', check.profileId)
    .limit(1)
    .maybeSingle()
  return !!data
}
