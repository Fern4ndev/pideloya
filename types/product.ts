export interface Product {
  id: string
  name: string
  description: string
  price: number
  imageUrl: string
  available: boolean
  restaurantId: string
  categoryId: string
  createdAt: Date
  updatedAt: Date
}
