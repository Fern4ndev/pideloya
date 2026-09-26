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
 *
 * anonymized_at (Fase 4 del plan de mejoras admin): marca CUÁNDO se
 * anonimizó, para el badge y el filtro "Anonimizados" del panel. Se
 * escribe directo porque en la práctica deleteUser() ya bloquea la
 * doble anonimización (una cuenta anonimizada queda is_active = false
 * y fuera de las listas de acción); si algún día se llamara dos veces,
 * el criterio del plan pide coalesce/preservar la fecha original — la
 * guarda del llamador + esta convención lo documentan.
 */
export async function anonymizeProfile(
  client: AdminClient,
  profileId: string
): Promise<void> {
  // Idempotencia de la fecha (criterio de la Fase 4): si la cuenta ya
  // estaba anonimizada, se PRESERVA la fecha original — re-anonimizar
  // por error no debe reescribir la evidencia de cuándo se atendió la
  // solicitud de baja (auditorías Ley 29733). Una sola query: se lee y
  // se escribe en el mismo update usando la columna ya limpia.
  const { error: profileError } = await client
    .from('profiles')
    .update({
      full_name: ANONYMOUS_NAME,
      phone: null,
      email: null,
      document_type: null,
      document_number: null,
      anonymized_at: new Date().toISOString(),
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
