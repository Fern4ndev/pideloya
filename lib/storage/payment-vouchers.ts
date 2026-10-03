import type { createServiceRoleClient } from '@/lib/db/server'
import { PAYMENT_VOUCHER_BUCKET, paymentVoucherPath } from '@/lib/constants/payment-voucher'

type AdminClient = ReturnType<typeof createServiceRoleClient>

/**
 * Borra del bucket privado los comprobantes de los pedidos indicados.
 *
 * SOLO SERVIDOR, y con `service_role`: el bucket no tiene —ni debe tener—
 * policy de DELETE para usuarios. El comprobante es la única evidencia que
 * tiene el repartidor de que le pagaron; si el cliente pudiera borrarlo, podría
 * dejarlo sin nada después de que el pedido ya arrancó.
 *
 * Es "mejor esfuerzo", igual que `deleteImageKitFileSafe`: los llamadores
 * invocan esto DESPUÉS de que la operación de negocio ya se ejecutó (el pedido
 * ya se canceló, la oferta ya se retiró, la cuenta ya se anonimizó). Un fallo
 * de Storage no puede deshacer eso ni, mucho menos, devolverle un error al
 * usuario: deja un archivo huérfano —el modo de fallo aceptable— y lo registra.
 *
 * Borrar una ruta que no existe NO es un error (la API de Storage responde OK),
 * así que llamarlo de más es inofensivo: por eso los llamadores no necesitan
 * comprobar antes si el pedido tenía comprobante.
 *
 * Nota: hay que usar la API de Storage y no un `delete from storage.objects`,
 * porque borrar la fila no elimina el archivo físico.
 */
export async function removePaymentVouchers(client: AdminClient, orderIds: string[]) {
  if (orderIds.length === 0) return

  const { error } = await client.storage
    .from(PAYMENT_VOUCHER_BUCKET)
    .remove(orderIds.map(paymentVoucherPath))

  if (error) {
    console.error('[vouchers] no se pudieron borrar:', error.message)
  }
}

/**
 * Borra el comprobante de UN pedido, con la guarda dura: **nunca** se toca el
 * de un pago ya confirmado.
 *
 * Dos casos según lo que haya en `deliveries`:
 *
 *   - Hay fila y `payment_confirmed_at` está puesto → no se borra nada. Es
 *     historial de dinero cobrado, y la imagen sigue siendo la constancia que
 *     el repartidor puede necesitar.
 *   - No hay fila (la oferta ya se retiró o expiró) → SÍ se borra. No es una
 *     excepción a la guarda: sin fila no hay pago confirmado posible, porque
 *     los tres caminos que borran la fila (cancelar, retirar, expirar) exigen
 *     `payment_confirmed_at is null`. Y es justo el caso del huérfano que hay
 *     que limpiar: el cliente alcanzó a subir el archivo y la confirmación
 *     falló.
 *
 * Como no hay fila no puede haber pago confirmado, el orden respecto al
 * borrado de la oferta no altera el resultado; aun así los llamadores la
 * invocan ANTES para que la guarda lea una fila viva y no un `null` de
 * conveniencia.
 */
export async function removeUnconfirmedVoucher(client: AdminClient, orderId: string) {
  const { data } = await client
    .from('deliveries')
    .select('payment_confirmed_at')
    .eq('order_id', orderId)
    .maybeSingle()

  if (data?.payment_confirmed_at) return

  await removePaymentVouchers(client, [orderId])
}
