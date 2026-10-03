'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/db/server'
import {
  PAYMENT_INCIDENT_KINDS,
  type PaymentIncidentKind,
} from '@/lib/constants/payment-incident'

const reportIncidentSchema = z.object({
  orderId: z.string().uuid('Pedido inválido'),
  kind: z.enum(PAYMENT_INCIDENT_KINDS),
  note: z
    .string()
    .trim()
    .max(500, 'La nota no puede pasar de 500 caracteres')
    .optional()
    // El input del diálogo arranca vacío: '' NO es un note válido para la base,
    // es "sin nota" (misma normalización que hace el RPC del lado del servidor).
    .transform((value) => (value ? value : undefined)),
})

/**
 * Registra una incidencia de pago en nombre del usuario autenticado.
 *
 * Toda la autorización vive en `report_payment_incident()` (SECURITY DEFINER):
 * valida que el llamador sea PARTE del pedido, que el tipo corresponda a su rol
 * y deduplica por (pedido, tipo, reportante, abierta). Acá NO se reimplementa
 * ninguna de esas reglas — se validaría dos veces y podrían divergir.
 *
 * El pedido NO cambia de estado (D8): el repartidor que no pudo cobrar sigue en
 * `ON_THE_WAY` y puede reintentar. La incidencia es la evidencia para soporte,
 * no una puerta de salida del flujo.
 *
 * Se usa el cliente normal (RLS + sesión), nunca service_role: la función
 * security definer ya resuelve los permisos y así el actor queda identificado
 * por su propia sesión, no por un id que mande el cliente.
 */
export async function reportPaymentIncident(
  orderId: string,
  kind: PaymentIncidentKind,
  note?: string
) {
  let data: z.infer<typeof reportIncidentSchema>
  try {
    data = reportIncidentSchema.parse({ orderId, kind, note })
  } catch (err) {
    if (err instanceof z.ZodError) {
      throw new Error(err.issues.map((issue) => issue.message).join(' '))
    }
    throw err
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('No autenticado')

  // La firma de la RPC declara `p_note` opcional: cuando no hay nota se omite
  // el argumento en vez de mandar `null` (PostgREST resolvería la sobrecarga
  // por el conjunto de claves enviadas).
  const { data: incidentId, error } = data.note
    ? await supabase.rpc('report_payment_incident', {
        p_order_id: data.orderId,
        p_kind: data.kind,
        p_note: data.note,
      })
    : await supabase.rpc('report_payment_incident', {
        p_order_id: data.orderId,
        p_kind: data.kind,
      })

  if (error) throw new Error(error.message)

  // La incidencia se ve en tres paneles: la lista del repartidor, la del
  // restaurante (si el reporte es suyo) y la bandeja del admin.
  revalidatePath('/repartidor/pedidos')
  revalidatePath('/restaurante/pedidos')
  revalidatePath('/admin/pagos')

  return { success: true, incidentId }
}
