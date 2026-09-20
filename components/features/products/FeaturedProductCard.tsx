'use client'

import { useState } from 'react'
import Image from 'next/image'
import { PlusIcon, UtensilsCrossedIcon } from 'lucide-react'
import { useCartStore } from '@/lib/hooks/use-cart'
import { Button } from '@/components/ui/button'

export interface FeaturedProduct {
  id: string
  name: string
  price: number
  imageUrl: string | null
  restaurant: { id: string; name: string }
}

export function FeaturedProductCard({ product }: { product: FeaturedProduct }) {
  const [justAdded, setJustAdded] = useState(false)
  const addItem = useCartStore((state) => state.addItem)
  const switchRestaurantAndAdd = useCartStore((state) => state.switchRestaurantAndAdd)

  function handleAdd() {
    const item = {
      productId: product.id,
      name: product.name,
      price: product.price,
      imageUrl: product.imageUrl,
    }
    const result = addItem(product.restaurant, item, 1)
    if (result === 'conflict') {
      const confirmSwitch = confirm(
        `Tu carrito tiene productos de otro negocio. ¿Vaciarlo y agregar "${product.name}" de ${product.restaurant.name}?`
      )
      if (!confirmSwitch) return
      switchRestaurantAndAdd(product.restaurant, item, 1)
    }
    setJustAdded(true)
    setTimeout(() => setJustAdded(false), 1200)
  }

  return (
    <div className="w-40 shrink-0 snap-start sm:w-44">
      <div className="relative aspect-square w-full overflow-hidden rounded-3xl bg-muted ring-1 ring-black/5 dark:ring-white/10">
        {product.imageUrl ? (
          <Image src={product.imageUrl} alt={product.name} fill sizes="176px" className="object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-brand-100 to-brand-50 text-brand-400">
            <UtensilsCrossedIcon className="h-8 w-8" />
          </div>
        )}
        <Button
          type="button"
          size="icon-sm"
          onClick={handleAdd}
          className="absolute bottom-2 right-2 rounded-full bg-brand-500 text-white shadow-md hover:bg-brand-600"
          aria-label={`Agregar ${product.name} al carrito`}
        >
          <PlusIcon className="h-4 w-4" />
        </Button>
      </div>
      <div className="mt-2">
        <p className="truncate text-sm font-medium">{product.name}</p>
        <p className="truncate text-xs text-muted-foreground">{product.restaurant.name}</p>
        <div className="mt-0.5 flex items-center justify-between">
          <span className="text-sm font-semibold">S/ {product.price.toFixed(2)}</span>
          {justAdded && <span className="text-xs font-medium text-green-600">Agregado ✓</span>}
        </div>
      </div>
    </div>
  )
}