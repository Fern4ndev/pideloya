'use client'

import Link from 'next/link'
import { useCartStore, cartItemCount } from '@/lib/hooks/use-cart'
import { Button } from '@/components/ui/button'

export function PublicHeader() {
  const items = useCartStore((state) => state.items)
  const itemCount = cartItemCount(items)

  return (
    <header className="sticky top-0 z-20 border-b bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
        <Link href="/" className="text-base font-semibold tracking-tight">
          PideloYa
        </Link>

        <div className="flex items-center gap-2">
          <Button
            render={<Link href="/cliente/carrito" />}
            nativeButton={false}
            variant="outline"
            size="sm"
            className="relative"
          >
            Carrito
            {itemCount > 0 && (
              <span className="ml-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-medium text-destructive-foreground">
                {itemCount}
              </span>
            )}
          </Button>
          <Button render={<Link href="/login" />} nativeButton={false} size="sm">
            Ingresar
          </Button>
        </div>
      </div>
    </header>
  )
}