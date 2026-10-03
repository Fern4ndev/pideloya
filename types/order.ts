import type { PaymentMethod, PaymentTiming } from '@/lib/constants/payment-method'

export type OrderStatus =
  | "PENDING"
  | "AWAITING_PAYMENT"
  | "ASSIGNED"
  | "PICKED_UP"
  | "ON_THE_WAY"
  | "DELIVERED"
  | "CANCELLED"

export interface ApiOrderItem {
  id: string
  order_id: string
  product_id: string | null
  product_name: string | null
  quantity: number
  unit_price: number
  image_url: string | null
  restaurant_id: string
  restaurant_name: string | null
  /** El negocio viene embebido solo con los datos del punto de recojo —
   * sin coordenadas: la tarifa la fija el repartidor al ver la dirección,
   * no un cálculo de distancia. */
  restaurants?: {
    name: string
    address_text: string | null
  } | null
}

export interface ApiOrder {
  id: string
  status: OrderStatus
  total: number
  /** Snapshot del envío cobrado por el repartidor. NULL hasta que el cliente
   * confirma el pago (nunca se suma a `total`: son ingresos de otro dueño). */
  delivery_fee: number | null
  /** [LEGACY] Cómo paga el cliente el pedido. Snapshot de
   * deliveries.payment_method, que la app YA NO ESCRIBE: con pago al recibir el
   * método no se pregunta y queda NULL; solo lo llenan las filas anteriores a
   * la migración 20261003100000. Presente para no romper con datos históricos. */
  payment_method: PaymentMethod | null
  /** Cuándo paga: UPFRONT = ahora, con Yape y comprobante; ON_DELIVERY = al
   * recibir, sin método asociado. Es el ÚNICO eje de la elección del cliente.
   * Snapshot de deliveries.payment_timing. */
  payment_timing: PaymentTiming | null
  /** Constancia D6 de que el repartidor declaró haberle pagado la comida al
   * restaurante al recoger. NULL mientras no lo declaró (o el pedido no llegó
   * a PICKED_UP). */
  restaurant_paid_at?: string | null
  created_at: string
  order_items?: ApiOrderItem[] | null
  addresses?: {
    address_text: string | null
    reference: string | null
    latitude: number
    longitude: number
  } | null
  deliveries?: {
    delivery_person_id: string | null
    delivery_fee: number | null
    /** Ruta del comprobante de Yape que el cliente adjuntó al confirmar el
     * pago. NULL mientras no haya confirmado (y en los pagos anteriores a esta
     * función). Basta con saber si EXISTE: la lista no carga la imagen, solo
     * avisa que hay algo que ver en el detalle. */
    /** [LEGACY] Cómo paga el cliente el envío de ESTE pedido (mismo valor que
     * el snapshot de `orders`). NULL en las entregas nuevas con pago al recibir
     * y en las legacy sin oferta. */
    payment_method?: PaymentMethod | null
    /** Cuándo paga (mismo valor que el snapshot de `orders`). */
    payment_timing?: PaymentTiming | null
    /** Snapshot D7 al enviar la oferta: el repartidor acepta cobrar al recibir
     * (adelantando la comida). False => solo pago por adelantado. */
    allows_pay_on_delivery?: boolean
    /** Constancia de que el repartidor finalizó la entrega CON COBRO. Solo con
     * payment_timing = 'ON_DELIVERY'; la escribe complete_delivery(). */
    collected_at?: string | null
    /** [LEGACY] Medio que el repartidor declaró al cobrar, de los ciclos
     * anteriores. `complete_delivery()` ya no lo escribe: el medio no se
     * pregunta y las filas nuevas lo dejan NULL. */
    collected_method?: PaymentMethod | null
    /** DEPRECADO (Fase 12): columna eliminada en la migración contract. Solo
     * presente mientras el tipo se regenere contra una base vieja. */
    cash_collected_at?: string | null
    payment_voucher_path?: string | null
  } | null
}

export interface Order {
  id: string
  customerId: string
  restaurantId: string
  deliveryId: string | null
  status: OrderStatus
  total: number
  createdAt: Date
  updatedAt: Date
}

/** Meta que acompaña al listado paginado de pedidos del cliente
 *  (`GET /api/v1/orders?offset=&limit=&status=`). Los conteos son globales
 *  (sin paginar): con páginas parciales ya no se pueden derivar en el cliente. */
export interface ApiOrdersMeta {
  counts: {
    all: number
    active: number
    delivered: number
    cancelled: number
    pending: number
  }
  limit: number
  offset: number
}
