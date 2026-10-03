/**
 * Pago del pedido (comida + envío) que el cliente elige cuando el repartidor
 * le manda su oferta.
 *
 * Todo el texto de la elección vive acá y no disperso por los componentes: son
 * las palabras que el cliente lee justo antes de mover dinero, y una sola de
 * ellas desalineada (decir "por Yape" a quien eligió efectivo) es un error que
 * no se detecta compilando. Un solo lugar, un solo copy.
 *
 * La elección tiene UN nivel: `Pagar ahora` (UPFRONT: Yape + comprobante) o
 * `Pagar al recibir` (ON_DELIVERY). Antes había un segundo eje — con qué paga
 * quien elige "al recibir" — que el repartidor volvía a declarar en la puerta
 * para que el sistema comparara una cosa con la otra. Nadie consumía ese dato:
 * el repartidor cobra con lo que el cliente le entregue, así que ahora con
 * ON_DELIVERY `payment_method` queda NULL (ver la migración 20261003100000).
 *
 * (D1, decisión del producto) En las DOS opciones el cliente le paga al
 * repartidor TODO el pedido —la comida y el envío—. Los dos montos ya existen
 * en el pedido (`total` = comida, `delivery_fee` = envío) y son snapshots que
 * no cambian después de confirmar, así que el monto a cobrar se deriva con
 * `amountDueToCourier()` y no se guarda en ninguna columna: un dato derivado no
 * se puede desincronizar.
 *
 * (D3) La elección es definitiva: una vez confirmada, el pedido sale de
 * `AWAITING_PAYMENT` y no hay camino de vuelta en la aplicación. Por eso el
 * aviso de `PAYMENT_METHOD_LOCK_NOTICE` se muestra ANTES del clic, no en un
 * diálogo de confirmación que solo agrega un paso a quien ya decidió.
 */

export const PAYMENT_METHODS = ['YAPE', 'CASH'] as const

export type PaymentMethod = (typeof PAYMENT_METHODS)[number]

/**
 * Por qué `text` + CHECK en la base y no un enum (D4): el dominio va a crecer
 * (Plin, tarjeta) y agregar un valor a un enum exige una migración donde el
 * valor nuevo todavía no se puede usar en la misma transacción — el problema
 * que ya se sufrió con `AWAITING_PAYMENT` (20260928100000). Este es el espejo
 * en TypeScript del CHECK `deliveries_collected_method_check`.
 *
 * Aviso: desde el pago al recibir SIN método, la aplicación ya no ESCRIBE
 * `payment_method`; la única etiqueta viva es la de `paymentLabel`, que lee
 * datos legacy. Si algún día se vuelve a preguntar el medio, su copy se escribe
 * acá — no antes.
 */

/** Aviso de irrevocabilidad (D3), visible ANTES del clic que confirma. */
export const PAYMENT_METHOD_LOCK_NOTICE = 'No podrás cambiarlo después.'

/** Ayuda visible mientras el cliente todavía no eligió (D2: sin preselección). */
export const PAYMENT_METHOD_PROMPT = 'Elige una opción para continuar'

/**
 * Cuándo paga el cliente: los DOS valores del único eje de la elección.
 */
export const PAYMENT_TIMINGS = ['UPFRONT', 'ON_DELIVERY'] as const

export type PaymentTiming = (typeof PAYMENT_TIMINGS)[number]

/**
 * Copy de cada opción. `subtitle` es una FUNCIÓN del monto a pagar al
 * repartidor (comida + envío, D1): el mismo número que decide la elección es
 * el que se muestra, y mostrarlo en la opción —en vez de en un párrafo
 * aparte— elimina la repetición del dato en la misma pantalla.
 */
export const PAYMENT_TIMING_COPY = {
  UPFRONT: {
    title: 'Pagar ahora',
    subtitle: (amount: string) => `Yape + comprobante · S/ ${amount}`,
  },
  ON_DELIVERY: {
    title: 'Pagar al recibir',
    subtitle: (amount: string) => `S/ ${amount} al entregarte el pedido`,
  },
} as const

/**
 * Estrecha el `text` de la base al tipo del dominio, con el mismo criterio
 * defensivo que `toPaymentMethod`: la base garantiza el valor (CHECK), pero
 * TypeScript solo ve `string | null` y la UI prefiere caer a su estado neutro
 * antes que mentirle al compilador con un cast.
 */
export function toPaymentTiming(value: string | null | undefined): PaymentTiming | null {
  return value === 'UPFRONT' || value === 'ON_DELIVERY' ? value : null
}

/**
 * Lo que el cliente le paga al repartidor en TODAS las opciones (D1
 * unificado): la comida (`orders.total`) más el envío (`orders.delivery_fee`).
 *
 * La función vive acá y no dispersa la suma por los componentes: un monto que
 * se calcula en dos lugares es un monto que puede desincronizarse.
 */
export function amountDueToCourier(total: number, fee: number | null | undefined): number {
  return Number(total) + Number(fee ?? 0)
}

/**
 * Etiqueta compuesta para chips y resúmenes, a partir de los DOS ejes. El
 * segundo eje ya no se pregunta, así que todo lo que llegue con timing
 * ON_DELIVERY —con método legacy o sin él— es "Pago al recibir": la etiqueta
 * describe lo que el cliente eligió, no el detalle que el sistema dejó de
 * pedir.
 *
 * `payment_method` (y la pareja sin timing) se conserva para leer datos
 * históricos; los pedidos nuevos llegan con ON_DELIVERY y método NULL.
 */
export function paymentLabel(
  method: PaymentMethod | null,
  timing: PaymentTiming | null
): string | null {
  if (timing === 'ON_DELIVERY') return 'Pago al recibir'
  if (method === 'YAPE') return 'Yape (pagado)'
  return null
}

/**
 * Estrecha el `text` de la base al tipo del dominio.
 *
 * La columna `payment_method` es `text` con un CHECK que la acota a 'YAPE' o
 * 'CASH' — la base garantiza el valor, pero TypeScript solo ve `string | null`.
 * En vez de cast (que le mentiría al compilador y aguantaría un valor raro
 * hasta reventar en la UI), cualquier cosa distinta de los dos métodos
 * conocidos se trata como "sin método": la pantalla muestra su estado neutro en
 * lugar de romperse.
 */
export function toPaymentMethod(value: string | null | undefined): PaymentMethod | null {
  return value === 'YAPE' || value === 'CASH' ? value : null
}
