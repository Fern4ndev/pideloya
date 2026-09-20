'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from '@/lib/actions/auth'
import { useCartStore, cartItemCount } from '@/lib/hooks/use-cart'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Logo } from '@/components/shared/Logo'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { LayoutDashboardIcon, PackageIcon, MapPinIcon, ShoppingBagIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

const NAV_LINKS = [
  { href: '/cliente', label: 'Inicio', icon: LayoutDashboardIcon },
  { href: '/cliente/pedidos', label: 'Mis pedidos', icon: PackageIcon },
  { href: '/cliente/direcciones', label: 'Direcciones', icon: MapPinIcon },
]

export function CustomerHeader({ fullName }: { fullName: string }) {
  const pathname = usePathname()
  const items = useCartStore((state) => state.items)
  const itemCount = useMemo(() => cartItemCount(items), [items])
  const initial = fullName.trim().charAt(0).toUpperCase() || '?'

  return (
    <header className="sticky top-0 z-40 border-b border-black/5 bg-white/70 backdrop-blur-xl backdrop-saturate-150 supports-[backdrop-filter]:bg-white/60 dark:border-white/10 dark:bg-neutral-950/60">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-2.5">
        <Link href="/cliente" className="flex shrink-0 items-center">
          <Logo height={30} />
        </Link>

        {/* Nav central — pill glass */}
        <nav className="hidden items-center gap-1 rounded-full border border-black/5 bg-black/[0.03] p-1 backdrop-blur sm:flex dark:border-white/10 dark:bg-white/5">
          {NAV_LINKS.map((link) => {
            const active = pathname === link.href
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  'flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition-all',
                  active
                    ? 'bg-brand-500 text-white shadow-sm shadow-brand-500/30'
                    : 'text-muted-foreground hover:bg-black/5 hover:text-foreground dark:hover:bg-white/10'
                )}
              >
                <link.icon className="h-3.5 w-3.5" />
                {link.label}
              </Link>
            )
          })}
        </nav>

        <div className="flex items-center gap-2">
          <Link
            href="/cliente/carrito"
            className={cn(
              'relative flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition-colors',
              pathname === '/cliente/carrito'
                ? 'border-brand-500 bg-brand-500 text-white'
                : 'border-black/5 bg-black/[0.03] text-foreground hover:bg-black/5 dark:border-white/10 dark:bg-white/5'
            )}
          >
            <ShoppingBagIcon className="h-4 w-4" />
            <span className="hidden sm:inline">Carrito</span>
            {itemCount > 0 && (
              <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-coral px-1 text-[10px] font-bold text-white ring-2 ring-white">
                {itemCount}
              </span>
            )}
          </Link>

          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <button className="rounded-full outline-none ring-brand-500/40 transition-shadow focus-visible:ring-2" />
              }
            >
              <Avatar className="h-9 w-9 ring-1 ring-black/5 dark:ring-white/10">
                <AvatarFallback className="bg-gradient-to-br from-brand-400 to-brand-600 text-sm font-semibold text-white">
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
      </div>

      {/* Nav inferior — mobile */}
      <nav className="flex items-center gap-1.5 overflow-x-auto border-t border-black/5 px-4 py-2 sm:hidden dark:border-white/10">
        {NAV_LINKS.map((link) => {
          const active = pathname === link.href
          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                'flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors',
                active
                  ? 'bg-brand-500 text-white'
                  : 'bg-black/[0.03] text-muted-foreground dark:bg-white/5'
              )}
            >
              <link.icon className="h-3.5 w-3.5" />
              {link.label}
            </Link>
          )
        })}
      </nav>
    </header>
  )
}