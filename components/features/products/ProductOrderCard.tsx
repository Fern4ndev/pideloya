'use client'

import { useState } from 'react'
import Image from 'next/image'
import { useCartStore } from '@/lib/hooks/use-cart'
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
  // El conflicto de "otro negocio en el carrito" se pregunta con AlertDialog
  // (Fase 4, accesible) y no con confirm(): el estado guarda el ítem pendiente
  // y el diálogo lo confirma o descarta.
  const [conflictPending, setConflictPending] = useState<{
    item: Parameters<ReturnType<typeof useCartStore.getState>['addItem']>[1]
  } | null>(null)
  const addItem = useCartStore((state) => state.addItem)
  const switchRestaurantAndAdd = useCartStore(
    (state) => state.switchRestaurantAndAdd
  )

  function markAdded() {
    setQuantity(1)
    setJustAdded(true)
    setTimeout(() => setJustAdded(false), 1200)
  }

  function handleAdd() {
    const item = {
      productId: product.id,
      name: product.name,
      price: product.price,
      imageUrl: product.imageUrl,
    }

    const result = addItem(restaurant, item, quantity)

    if (result === 'conflict') {
      setConflictPending({ item })
      return
    }

    markAdded()
  }

  function handleConfirmSwitch() {
    if (!conflictPending) return
    switchRestaurantAndAdd(restaurant, conflictPending.item, quantity)
    setConflictPending(null)
    markAdded()
  }

  return (
    <div className="group relative flex gap-4 rounded-3xl p-3.5 shadow-client-card">
      <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-muted">
        {product.imageUrl ? (
          <Image
            src={product.imageUrl}
            alt={product.name}
            fill
            sizes="80px"
            className="object-cover transition-transform duration-300 ease-client group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-lg font-medium text-muted-foreground">
            {product.name.charAt(0)}
          </div>
        )}

        {/* Confirmación flotante sobre la foto en vez de reemplazar el texto
            del botón: la región `aria-live` existe siempre en el DOM (si se
            montara junto con su texto, los lectores de pantalla no
            anunciarían el cambio). */}
        <span
          aria-live="polite"
          className={cn(
            'pointer-events-none absolute left-1.5 top-1.5 rounded-full bg-lime px-2 py-0.5 text-[10px] font-bold text-[#0C0C0E] shadow-sm transition-opacity duration-150',
            justAdded ? 'animate-stat-in opacity-100' : 'opacity-0'
          )}
        >
          {justAdded ? 'Agregado ✓' : ''}
        </span>
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
          {/* Stepper unificado (un control con fondo propio en vez de dos
              botones sueltos con un número en medio). Los botones van a 40px
              para cumplir el objetivo táctil mínimo de 40×40. */}
          <div className="inline-flex items-center gap-1 rounded-full bg-muted/60 p-1">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="h-10 w-10 rounded-full"
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              disabled={disabled}
              aria-label="Quitar una unidad"
            >
              −
            </Button>
            <span className="w-5 text-center text-sm font-medium tabular-nums">{quantity}</span>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="h-10 w-10 rounded-full"
              onClick={() => setQuantity((q) => q + 1)}
              disabled={disabled}
              aria-label="Agregar una unidad"
            >
              +
            </Button>
          </div>
          <Button
            type="button"
            size="sm"
            className={cn('rounded-full', justAdded && 'animate-add-pulse')}
            onClick={handleAdd}
            disabled={disabled}
          >
            Agregar
          </Button>
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
              vaciará y se agregarán {quantity} × &quot;{product.name}&quot; de{' '}
              {restaurant.name}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Conservar mi carrito</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={handleConfirmSwitch}
            >
              Vaciar y agregar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}