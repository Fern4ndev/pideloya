import type { createServiceRoleClient } from '@/lib/db/server'

type AdminClient = ReturnType<typeof createServiceRoleClient>

export const ANONYMOUS_NAME = 'Usuario eliminado'
export const ANONYMOUS_ADDRESS_TEXT = 'Dirección eliminada'

/**
 * Anonimiza la PII editable de un perfil con historial transaccional
 * (Fase 3/Fase 5 del plan de eliminación de cuentas — Ley 29733):
 *
 *   - profiles: full_name, phone, document_type, document_number, email
 *     son dato personal identificable → se limpian.
 *   - addresses: address_text/reference también identifican → se limpian.
 *     NO se borran las filas: orders.address_id sigue apuntando a una
 *     fila válida (y lat/lng se conservan para métricas agregadas; no
 *     identifican por sí solas).
 *   - orders.customer_name / customer_phone: NO se tocan. Son snapshot
 *     histórico intencional "al momento del pedido" (igual que
 *     product_name en order_items), no dato vivo del perfil.
 *
 * El rol DELIVERY no llega aquí hoy (deleteUser solo se invoca desde la
 * tabla de clientes), pero el helper es agnóstico del rol a propósito.
 */
export async function anonymizeProfile(
  client: AdminClient,
  profileId: string
): Promise<void> {
  const { error: profileError } = await client
    .from('profiles')
    .update({
      full_name: ANONYMOUS_NAME,
      phone: null,
      email: null,
      document_type: null,
      document_number: null,
    })
    .eq('id', profileId)
  if (profileError) throw new Error(profileError.message)

  const { error: addressError } = await client
    .from('addresses')
    .update({
      address_text: ANONYMOUS_ADDRESS_TEXT,
      reference: null,
    })
    .eq('customer_id', profileId)
  if (addressError) throw new Error(addressError.message)
}
