'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ShoppingBagIcon } from 'lucide-react'
import { useCartStore, cartItemCount, cartTotal } from '@/lib/hooks/use-cart'
import { Button } from '@/components/ui/button'

export function CartBar() {
  const pathname = usePathname()
  const items = useCartStore((state) => state.items)
  const restaurantName = useCartStore((state) => state.restaurantName)

  const itemCount = cartItemCount(items)

  if (itemCount === 0 || pathname === '/cliente/carrito') return null

  const total = cartTotal(items)

  return (
    <div className="fixed inset-x-0 bottom-4 z-30 flex justify-center px-4">
      <Button
        render={<Link href="/cliente/carrito" />}
        nativeButton={false}
        className="flex h-auto w-full max-w-md items-center justify-between gap-3 rounded-full bg-brand-500 px-5 py-3.5 text-white shadow-lg shadow-black/20 hover:bg-brand-600"
      >
        <span className="flex min-w-0 items-center gap-2 text-sm font-medium">
          <ShoppingBagIcon className="h-4 w-4 shrink-0" />
          <span className="truncate">
            {itemCount} {itemCount === 1 ? 'producto' : 'productos'}
            {restaurantName ? ` · ${restaurantName}` : ''}
          </span>
        </span>
        <span className="shrink-0 text-sm font-semibold">S/ {total.toFixed(2)}</span>
      </Button>
    </div>
  )
}