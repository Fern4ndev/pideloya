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
