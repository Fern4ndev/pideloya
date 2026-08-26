import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

export interface CartItem {
  productId: string
  name: string
  price: number
  quantity: number
  imageUrl: string | null
}

interface RestaurantRef {
  id: string
  name: string
}

interface CartState {
  restaurantId: string | null
  restaurantName: string | null
  items: CartItem[]

  /**
   * Intenta agregar un producto. Si el carrito ya tiene productos de OTRO
   * restaurante, no modifica nada y devuelve 'conflict' — la UI decide
   * qué hacer (normalmente: preguntar si vaciar el carrito primero).
   */
  addItem: (
    restaurant: RestaurantRef,
    item: Omit<CartItem, 'quantity'>,
    quantity?: number
  ) => 'added' | 'conflict'

  /** Vacía el carrito actual y arranca uno nuevo con este ítem. */
  switchRestaurantAndAdd: (
    restaurant: RestaurantRef,
    item: Omit<CartItem, 'quantity'>,
    quantity?: number
  ) => void

  removeItem: (productId: string) => void
  setQuantity: (productId: string, quantity: number) => void
  clear: () => void
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      restaurantId: null,
      restaurantName: null,
      items: [],

      addItem: (restaurant, item, quantity = 1) => {
        const state = get()

        if (state.restaurantId && state.restaurantId !== restaurant.id) {
          return 'conflict'
        }

        set((state) => {
          const existing = state.items.find(
            (i) => i.productId === item.productId
          )
          const items = existing
            ? state.items.map((i) =>
                i.productId === item.productId
                  ? { ...i, quantity: i.quantity + quantity }
                  : i
              )
            : [...state.items, { ...item, quantity }]

          return {
            restaurantId: restaurant.id,
            restaurantName: restaurant.name,
            items,
          }
        })

        return 'added'
      },

      switchRestaurantAndAdd: (restaurant, item, quantity = 1) => {
        set({
          restaurantId: restaurant.id,
          restaurantName: restaurant.name,
          items: [{ ...item, quantity }],
        })
      },

      removeItem: (productId) =>
        set((state) => {
          const items = state.items.filter((i) => i.productId !== productId)
          return {
            items,
            restaurantId: items.length ? state.restaurantId : null,
            restaurantName: items.length ? state.restaurantName : null,
          }
        }),

      setQuantity: (productId, quantity) =>
        set((state) => {
          if (quantity <= 0) {
            const items = state.items.filter((i) => i.productId !== productId)
            return {
              items,
              restaurantId: items.length ? state.restaurantId : null,
              restaurantName: items.length ? state.restaurantName : null,
            }
          }
          return {
            items: state.items.map((i) =>
              i.productId === productId ? { ...i, quantity } : i
            ),
          }
        }),

      clear: () => set({ restaurantId: null, restaurantName: null, items: [] }),
    }),
    {
      // Persiste en localStorage — si el cliente cierra el navegador a
      // medio pedido, no pierde lo que ya había elegido.
      name: 'pideloya-cart',
      storage: createJSONStorage(() => localStorage),
    }
  )
)

export function cartTotal(items: CartItem[]): number {
  return items.reduce((sum, i) => sum + i.price * i.quantity, 0)
}

export function cartItemCount(items: CartItem[]): number {
  return items.reduce((sum, i) => sum + i.quantity, 0)
}