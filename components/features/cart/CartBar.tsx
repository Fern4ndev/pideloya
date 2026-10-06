'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { m } from 'motion/react'
import { ShoppingCartIcon } from 'lucide-react'
import { useCartStore, cartItemCount, cartTotal } from '@/lib/hooks/use-cart'
import { Button } from '@/components/ui/button'

export function CartBar() {
  const pathname = usePathname()
  const items = useCartStore((state) => state.items)
  const restaurantName = useCartStore((state) => state.restaurantName)
  const itemCount = cartItemCount(items)

  // En /cliente/carrito no se renderiza nunca (esa pantalla ya muestra el
  // total). En el resto del panel queda montada y oculta en vez de
  // desmontarse, para que la salida se pueda animar cuando el carrito se
  // vacía; `inert` la saca del foco y del árbol de accesibilidad mientras
  // está invisible (un enlace invisible pero enfocable es una trampa de
  // teclado).
  if (pathname === '/cliente/carrito') return null

  const visible = itemCount > 0
  const total = cartTotal(items)

  return (
    <>
      {/* Dock de medición del vuelo (FlyToCartProvider): placeholder invisible
          siempre montado con el rect final del pill, para que el primer
          producto —cuando el pill aún está oculto— vuele al punto exacto
          donde el CartBar va a aparecer. */}
      <div
        aria-hidden
        data-cart-target="bar-dock"
        className="invisible fixed inset-x-0 bottom-4 mx-auto h-14 w-full max-w-md"
      />
      <m.div
        initial={false}
        animate={
          visible
            ? { y: 0, opacity: 1, scale: 1 }
            : { y: 16, opacity: 0, scale: 0.95 }
        }
        transition={{ type: 'spring', stiffness: 400, damping: 28 }}
        className={`fixed inset-x-0 bottom-4 z-30 flex justify-center px-4${
          visible ? '' : ' pointer-events-none'
        }`}
        aria-hidden={!visible}
        inert={!visible}
      >
        <Button
          render={<Link href="/cliente/carrito" />}
          nativeButton={false}
          data-cart-target="bar"
          className="flex h-auto w-full max-w-md items-center justify-between gap-3 rounded-full border border-white/20 bg-gradient-to-r from-brand-500 to-brand-600 px-5 py-3.5 text-white shadow-xl shadow-brand-500/30 backdrop-blur-xl hover:from-brand-600 hover:to-brand-700"
        >
          <span className="flex min-w-0 items-center gap-2 text-sm font-medium">
            <ShoppingCartIcon className="h-4 w-4 shrink-0" />
            <span className="truncate">
              {itemCount} {itemCount === 1 ? 'producto' : 'productos'}
              {restaurantName ? ` · ${restaurantName}` : ''}
            </span>
          </span>
          <m.span
            key={total}
            initial={{ scale: 0.85 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 500, damping: 22 }}
            className="shrink-0 rounded-full bg-white/20 px-2.5 py-1 text-base font-bold"
          >
            S/ {total.toFixed(2)}
          </m.span>
        </Button>
      </m.div>
    </>
  )
}