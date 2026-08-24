export type OrderStatus =
  | "PENDING"
  | "ASSIGNED"
  | "PICKED_UP"
  | "ON_THE_WAY"
  | "DELIVERED"
  | "CANCELLED"

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
