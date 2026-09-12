'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from '@/lib/actions/auth'
import { useCartStore, cartItemCount } from '@/lib/hooks/use-cart'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

const NAV_LINKS = [
  { href: '/cliente', label: 'Inicio' },
  { href: '/cliente/pedidos', label: 'Mis pedidos' },
  { href: '/cliente/direcciones', label: 'Direcciones' },
]

export function CustomerHeader({ fullName }: { fullName: string }) {
  const pathname = usePathname()
  const items = useCartStore((state) => state.items)
  const itemCount = useMemo(() => cartItemCount(items), [items])
  const initial = fullName.trim().charAt(0).toUpperCase() || '?'

  return (
    <header className="sticky top-0 z-20 border-b bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <Link href="/cliente" className="text-base font-semibold tracking-tight">
          PideloYa
        </Link>

        <nav className="hidden items-center gap-1 sm:flex">
          {NAV_LINKS.map((link) => {
            const active = pathname === link.href
            return (
              <Button
                key={link.href}
                render={<Link href={link.href} />}
                nativeButton={false}
                variant={active ? 'default' : 'ghost'}
                size="sm"
                className="rounded-full"
              >
                {link.label}
              </Button>
            )
          })}
          <Button
            render={<Link href="/cliente/carrito" />}
            nativeButton={false}
            variant={pathname === '/cliente/carrito' ? 'default' : 'ghost'}
            size="sm"
            className="relative rounded-full"
          >
            Carrito
            {itemCount > 0 && (
              <span className="ml-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-medium text-destructive-foreground">
                {itemCount}
              </span>
            )}
          </Button>
        </nav>

        <DropdownMenu>
          <DropdownMenuTrigger render={<button className="rounded-full" />}>
            <Avatar className="h-9 w-9">
              <AvatarFallback className="text-sm font-medium">
                {initial}
              </AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuGroup>
              <DropdownMenuLabel className="truncate text-xs font-normal text-muted-foreground">
                {fullName}
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem render={<Link href="/cliente/perfil" />}>
              Mi perfil
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <form action={signOut}>
              <DropdownMenuItem
                render={<button type="submit" className="w-full text-left" />}
                nativeButton={true}
                variant="destructive"
              >
                Cerrar sesión
              </DropdownMenuItem>
            </form>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Nav inferior para mobile */}
      <nav className="flex items-center gap-1 overflow-x-auto border-t px-4 py-2 sm:hidden">
        {NAV_LINKS.map((link) => {
          const active = pathname === link.href
          return (
            <Button
              key={link.href}
              render={<Link href={link.href} />}
              nativeButton={false}
              variant={active ? 'default' : 'ghost'}
              size="sm"
              className="shrink-0 rounded-full"
            >
              {link.label}
            </Button>
          )
        })}
        <Button
          render={<Link href="/cliente/carrito" />}
          nativeButton={false}
          variant={pathname === '/cliente/carrito' ? 'default' : 'ghost'}
          size="sm"
          className="relative shrink-0 rounded-full"
        >
          Carrito
          {itemCount > 0 && (
            <span className="ml-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-medium text-destructive-foreground">
              {itemCount}
            </span>
          )}
        </Button>
      </nav>
    </header>
  )
}
