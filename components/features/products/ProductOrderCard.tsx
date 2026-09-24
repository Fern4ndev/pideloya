'use client'

import { useState } from 'react'
import Image from 'next/image'
import { useCartStore } from '@/lib/hooks/use-cart'
import { Button } from '@/components/ui/button'

export interface OrderableProduct {
  id: string
  name: string
  description: string | null
  price: number
  imageUrl: string | null
}

export function ProductOrderCard({
  product,
  restaurant,
  disabled = false,
}: {
  product: OrderableProduct
  restaurant: { id: string; name: string }
  disabled?: boolean
}) {
  const [quantity, setQuantity] = useState(1)
  const [justAdded, setJustAdded] = useState(false)
  const addItem = useCartStore((state) => state.addItem)
  const switchRestaurantAndAdd = useCartStore(
    (state) => state.switchRestaurantAndAdd
  )

  function handleAdd() {
    const item = {
      productId: product.id,
      name: product.name,
      price: product.price,
      imageUrl: product.imageUrl,
    }

    const result = addItem(restaurant, item, quantity)

    if (result === 'conflict') {
      const confirmSwitch = confirm(
        `Tu carrito tiene productos de otro negocio. ¿Vaciarlo y agregar "${product.name}" de ${restaurant.name}?`
      )
      if (!confirmSwitch) return
      switchRestaurantAndAdd(restaurant, item, quantity)
    }

    setQuantity(1)
    setJustAdded(true)
    setTimeout(() => setJustAdded(false), 1200)
  }

  return (
    <div className="flex gap-4 rounded-xl border p-3">
      <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-muted">
        {product.imageUrl ? (
          <Image
            src={product.imageUrl}
            alt={product.name}
            fill
            sizes="80px"
            className="object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-lg font-medium text-muted-foreground">
            {product.name.charAt(0)}
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <h3 className="text-sm font-semibold">{product.name}</h3>
        {product.description && (
          <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">
            {product.description}
          </p>
        )}
        <p className="mt-1 text-sm font-medium">
          S/ {product.price.toFixed(2)}
        </p>

        <div className="mt-2 flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              disabled={disabled}
            >
              −
            </Button>
            <span className="w-5 text-center text-sm">{quantity}</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setQuantity((q) => q + 1)}
              disabled={disabled}
            >
              +
            </Button>
          </div>
          <Button type="button" size="sm" onClick={handleAdd} disabled={disabled}>
            {justAdded ? 'Agregado ✓' : 'Agregar'}
          </Button>
        </div>
      </div>
    </div>
  )
}