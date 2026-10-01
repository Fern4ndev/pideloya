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
  /** Cómo paga el cliente el pedido. NULL mientras no eligió y en los pedidos
   * legacy aceptados sin oferta. Snapshot de deliveries.payment_method. */
  payment_method: PaymentMethod | null
  /** Cuándo paga (D2): UPFRONT = ahora con comprobante; ON_DELIVERY = al
   * recibir (Yape o efectivo). Snapshot de deliveries.payment_timing. */
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
    /** Cómo paga el cliente el envío de ESTE pedido (mismo valor que el
     * snapshot de `orders`). NULL en las entregas legacy sin oferta. */
    payment_method?: PaymentMethod | null
    /** Cuándo paga (mismo valor que el snapshot de `orders`). */
    payment_timing?: PaymentTiming | null
    /** Snapshot D7 al enviar la oferta: el repartidor acepta cobrar al recibir
     * (adelantando la comida). False => solo pago por adelantado. */
    allows_pay_on_delivery?: boolean
    /** Cuándo y CON QUÉ el repartidor DECLARÓ haber cobrado al entregar (D4).
     * Puede diferir de payment_method (lo anunciado): el desvío es válido y se
     * audita. Solo con payment_timing = 'ON_DELIVERY'. */
    collected_at?: string | null
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
