export type OrderStatus =
  | "PENDING"
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
  restaurants?: { name: string; address_text: string | null } | null
}

export interface ApiOrder {
  id: string
  status: OrderStatus
  total: number
  created_at: string
  order_items?: ApiOrderItem[] | null
  addresses?: { address_text: string | null; reference: string | null } | null
  deliveries?: { delivery_person_id: string | null } | null
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
