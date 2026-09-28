import { deleteImageKitFileSafe } from '@/lib/imagekit-server'
import { removePaymentVouchers } from '@/lib/storage/payment-vouchers'
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
 *   - profiles: avatar_url/yape_qr_url (y sus fileId) también. Son las
 *     primeras IMÁGENES de PII del sistema, y una foto de rostro
 *     identifica más que un nombre. No basta con nullar la columna: la
 *     URL de ImageKit es pública, así que el archivo se borra también de
 *     ImageKit — si no, la cara del usuario seguiría accesible para
 *     siempre por su enlace directo.
 *   - addresses: address_text/reference también identifican → se limpian.
 *     NO se borran las filas: orders.address_id sigue apuntando a una
 *     fila válida (y lat/lng se conservan para métricas agregadas; no
 *     identifican por sí solas).
 *   - orders.customer_name / customer_phone: NO se tocan. Son snapshot
 *     histórico intencional "al momento del pedido" (igual que
 *     product_name en order_items), no dato vivo del perfil.
 *   - Los COMPROBANTES de pago (vouchers de Yape) que el cliente subió sí
 *     se borran del bucket privado: una captura de Yape lleva nombre, monto
 *     y número de operación, así que identifica al cliente igual que las
 *     otras imágenes de PII. El registro de la TRANSACCIÓN (monto, fechas,
 *     snapshots) se conserva; la imagen no. Es el mismo principio que ya
 *     rige para la foto de perfil y el QR del repartidor.
 *
 * Llega cualquier rol con historial transaccional: deleteUser() deriva a
 * CUSTOMER y a DELIVERY (los repartidores con al menos una entrega
 * pasan por aquí), y el helper es agnóstico del rol a propósito. Por eso
 * la limpieza de la foto de perfil y del QR de Yape importa: son campos
 * que hoy solo llena un repartidor.
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
  // Las dos lecturas van en paralelo (son independientes: una tabla cada una),
  // y ambas ANTES de anonimizar por el mismo motivo: son los punteros a los
  // archivos, y los updates de abajo los sacan de las filas. Si se leyeran
  // después, no habría con qué borrarlos.
  //
  // Los pedidos se buscan por `customer_id` sin preguntar el rol: para un
  // repartidor o un restaurante la lista vuelve vacía y el borrado de
  // comprobantes es un no-op. Es lo que mantiene este helper agnóstico del rol.
  const [{ data: current }, { data: customerOrders }] = await Promise.all([
    client
      .from('profiles')
      .select('avatar_file_id, yape_qr_file_id')
      .eq('id', profileId)
      .maybeSingle(),
    client.from('orders').select('id').eq('customer_id', profileId),
  ])

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
      avatar_url: null,
      avatar_file_id: null,
      yape_qr_url: null,
      yape_qr_file_id: null,
      anonymized_at: new Date().toISOString(),
    })
    .eq('id', profileId)
  if (profileError) throw new Error(profileError.message)

  // Se borran de ImageKit apenas la fila deja de referenciarlos, y ANTES
  // de las direcciones: así la ventana en que una foto de rostro sigue
  // públicamente accesible es lo más corta posible aunque el paso
  // siguiente falle. `deleteImageKitFileSafe` nunca lanza (mejor
  // esfuerzo): un fallo de red hacia ImageKit no debe dejar la
  // anonimización de la cuenta a medias.
  await Promise.all([
    deleteImageKitFileSafe(current?.avatar_file_id),
    deleteImageKitFileSafe(current?.yape_qr_file_id),
    removePaymentVouchers(
      client,
      (customerOrders ?? []).map((o) => o.id)
    ),
  ])

  const { error: addressError } = await client
    .from('addresses')
    .update({
      address_text: ANONYMOUS_ADDRESS_TEXT,
      reference: null,
    })
    .eq('customer_id', profileId)
  if (addressError) throw new Error(addressError.message)
}
