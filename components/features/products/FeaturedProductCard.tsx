'use client'

import { useRef, useState } from 'react'
import Image from 'next/image'
import { PlusIcon, UtensilsCrossedIcon } from 'lucide-react'
import { useCartStore } from '@/lib/hooks/use-cart'
import { useRequestFlyToCart } from '@/lib/hooks/use-fly-to-cart'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { cn } from '@/lib/utils'

export interface FeaturedProduct {
  id: string
  name: string
  price: number
  imageUrl: string | null
  restaurant: { id: string; name: string }
}

export function FeaturedProductCard({
  product,
  disabled = false,
}: {
  product: FeaturedProduct
  disabled?: boolean
}) {
  const [justAdded, setJustAdded] = useState(false)
  const imageRef = useRef<HTMLDivElement>(null)
  const requestFly = useRequestFlyToCart()
  // Conflicto de carrito con AlertDialog accesible (Fase 4) en vez de
  // confirm(): el estado guarda el ítem pendiente y el diálogo lo confirma
  // o descarta — mismo patrón que ProductOrderCard.
  const [conflictPending, setConflictPending] = useState<{
    item: Parameters<ReturnType<typeof useCartStore.getState>['addItem']>[1]
  } | null>(null)
  const addItem = useCartStore((state) => state.addItem)
  const switchRestaurantAndAdd = useCartStore((state) => state.switchRestaurantAndAdd)

  function notifyAdded() {
    requestFly(imageRef.current, {
      imageUrl: product.imageUrl,
      productName: product.name,
    })
    setJustAdded(true)
    setTimeout(() => setJustAdded(false), 1200)
  }

  function handleAdd() {
    if (disabled) return
    const item = {
      productId: product.id,
      name: product.name,
      price: product.price,
      imageUrl: product.imageUrl,
    }
    const result = addItem(product.restaurant, item, 1)
    if (result === 'conflict') {
      setConflictPending({ item })
      return
    }
    notifyAdded()
  }

  function handleConfirmSwitch() {
    if (!conflictPending) return
    switchRestaurantAndAdd(product.restaurant, conflictPending.item, 1)
    setConflictPending(null)
    notifyAdded()
  }

  return (
    <div className="w-40 shrink-0 snap-start sm:w-44">
      <div
        ref={imageRef}
        className="relative aspect-square w-full overflow-hidden rounded-3xl bg-muted ring-1 ring-black/5 dark:ring-white/10"
      >
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
          disabled={disabled}
          className={cn(
            'absolute bottom-2 right-2 rounded-full bg-brand-500 text-white shadow-md transition-transform duration-150 hover:bg-brand-600',
            justAdded && 'animate-add-pulse'
          )}
          aria-label={`Agregar ${product.name} al carrito`}
        >
          <PlusIcon className="h-4 w-4" />
        </Button>

        {/* Confirmación flotante sobre la foto en vez de reemplazar el precio:
            el precio es el dato que el usuario estaba mirando y no debe
            desaparecer 1.2s. La región `aria-live` existe siempre en el DOM
            (si se montara junto con su texto, los lectores de pantalla no
            anunciarían el cambio). */}
        <span
          aria-live="polite"
          className={cn(
            'pointer-events-none absolute left-2 top-2 rounded-full bg-lime px-2.5 py-1 text-[11px] font-bold text-[#0C0C0E] shadow-sm transition-opacity duration-150',
            justAdded ? 'animate-stat-in opacity-100' : 'opacity-0'
          )}
        >
          {justAdded ? 'Agregado ✓' : ''}
        </span>
      </div>
      <div className="mt-2">
        <p className="truncate text-sm font-medium">{product.name}</p>
        <p className="truncate text-xs text-muted-foreground">{product.restaurant.name}</p>
        <div className="mt-0.5 flex items-center justify-between">
          <span className="text-sm font-semibold">S/ {product.price.toFixed(2)}</span>
        </div>
      </div>

      {/* Conflicto de carrito: AlertDialog accesible en vez de confirm(). */}
      <AlertDialog
        open={conflictPending !== null}
        onOpenChange={(open) => {
          if (!open) setConflictPending(null)
        }}
      >
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>¿Vaciar tu carrito?</AlertDialogTitle>
            <AlertDialogDescription>
              Tu carrito tiene productos de otro negocio. Si continúas, se
              vaciará y se agregará &quot;{product.name}&quot; de{' '}
              {product.restaurant.name}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Conservar mi carrito</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleConfirmSwitch}>
              Vaciar y agregar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}