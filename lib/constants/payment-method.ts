/**
 * Método de pago del ENVÍO que el cliente elige cuando el repartidor le manda
 * su oferta (YAPE | CASH).
 *
 * Todo el texto de la elección vive acá y no disperso por los componentes: son
 * las palabras que el cliente lee justo antes de mover dinero, y una sola de
 * ellas desalineada (decir "por Yape" a quien eligió efectivo) es un error que
 * no se detecta compilando. Un solo lugar, un solo copy.
 *
 * (D1, decisión del producto) Con CASH el cliente le paga al repartidor TODO el
 * pedido —la comida y el envío— al recibirlo. Los dos montos ya existen en el
 * pedido (`total` = comida, `delivery_fee` = envío) y son snapshots que no
 * cambian después de confirmar, así que el monto a cobrar se deriva con
 * `cashAmountDue()` y no se guarda en ninguna columna: un dato derivado no se
 * puede desincronizar.
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
 * que ya se sufrió con `AWAITING_PAYMENT` (20260928100000). Este es el espejo en
 * TypeScript del CHECK `deliveries_payment_method_check`: si se agrega un
 * método, se tocan los dos (y `PAYMENT_METHOD_COPY`).
 */
export const PAYMENT_METHOD_COPY: Record<
  PaymentMethod,
  { title: string; subtitle: string; short: string }
> = {
  CASH: {
    title: 'Pagar al recibir',
    subtitle: 'En efectivo, cuando te entreguen el pedido (comida + envío)',
    short: 'Efectivo al recibir',
  },
  YAPE: {
    title: 'Pagar ahora',
    subtitle: 'Por Yape: escaneas su QR y subes tu comprobante',
    short: 'Yape',
  },
}

/** Ayuda visible mientras el cliente todavía no eligió (D2: sin preselección). */
export const PAYMENT_METHOD_PROMPT = 'Elige una opción para continuar'

/** Aviso de irrevocabilidad (D3), visible ANTES del clic que confirma. */
export const PAYMENT_METHOD_LOCK_NOTICE = 'No podrás cambiar el método después de confirmar.'

/**
 * Cuándo paga el cliente (D2 del plan "Pagar al recibir"): el SEGUNDO eje de
 * la elección, independiente del método. Con dos columnas la UI reacciona a
 * cada eje por separado — mostrar QR ⇐ método Yape; exigir comprobante ⇐
 * UPFRONT — sin un tercer valor compuesto que obligue a `if` anidados.
 */
export const PAYMENT_TIMINGS = ['UPFRONT', 'ON_DELIVERY'] as const

export type PaymentTiming = (typeof PAYMENT_TIMINGS)[number]

export const PAYMENT_TIMING_COPY = {
  UPFRONT: {
    title: 'Pagar ahora',
    subtitle: 'Por Yape, con comprobante. Tu repartidor compra con tu dinero.',
  },
  ON_DELIVERY: {
    title: 'Pagar al recibir',
    subtitle: 'Cuando te entreguen el pedido (efectivo o Yape).',
  },
} as const

/**
 * Sub-grupo del nivel 2: con qué paga quien eligió "al recibir". Los mismos
 * dos valores de `PAYMENT_METHODS`, con copy propio — "Pagar ahora" ya no
 * describe esta decisión: aquí ninguna opción mueve dinero todavía.
 */
export const ON_DELIVERY_METHOD_COPY = {
  CASH: {
    title: 'Efectivo',
    subtitle: 'Entrega el monto exacto si puedes.',
  },
  YAPE: {
    title: 'Yape',
    subtitle: 'Escaneas el QR de tu repartidor al recibir.',
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
 * Lo que el cliente le paga al repartidor en TODOS los métodos (D1 unificado):
 * la comida (`orders.total`) más el envío (`orders.delivery_fee`).
 *
 * Antes solo el efectivo sumaba los dos y el Yape "por adelantado" cobraba el
 * QR por el envío solo; con el modelo "el repartidor compra el pedido", el
 * cliente siempre cubre la comida. La función vive acá y no dispersa la suma
 * por los componentes: un monto que se calcula en dos lugares es un monto que
 * puede desincronizarse.
 */
export function amountDueToCourier(total: number, fee: number | null | undefined): number {
  return Number(total) + Number(fee ?? 0)
}

/**
 * Etiqueta compuesta para chips y resúmenes, a partir de los DOS ejes. Si
 * algún día se muestra un pedido con método pero sin timing (imposible en la
 * base por el CHECK de pareja, posible en datos viejos en memoria), cae a la
 * etiqueta simple del método.
 */
export function paymentLabel(
  method: PaymentMethod | null,
  timing: PaymentTiming | null
): string | null {
  if (!method) return null
  if (method === 'CASH') return 'Efectivo al recibir'
  return timing === 'ON_DELIVERY' ? 'Yape al recibir' : 'Yape (pagado)'
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
