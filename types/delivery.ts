export interface Delivery {
  id: string
  orderId: string
  deliveryId: string
  status: "AVAILABLE" | "ACCEPTED" | "DELIVERED"
  createdAt: Date
  updatedAt: Date
}
