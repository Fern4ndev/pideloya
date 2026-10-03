'use client'

import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { signOut } from '@/lib/actions/auth'
import { useCartStore, cartItemCount } from '@/lib/hooks/use-cart'
import { useSearchStore } from '@/lib/hooks/use-search'
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
import {
  MenuIcon,
  XIcon,
  UserIcon,
  LogOutIcon,
  PackageIcon,
  MapPinIcon,
  ShoppingCartIcon,
  SearchIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const NAV_LINKS = [
  { href: '/cliente/pedidos', label: 'Mis pedidos', icon: PackageIcon },
  { href: '/cliente/direcciones', label: 'Dirección', icon: MapPinIcon },
]

/**
 * Elevación del header al hacer scroll.
 *
 * Se lee como store externo con `useSyncExternalStore` en vez de
 * `useState` + listener: el snapshot es un boolean, así que React sólo
 * re-renderiza cuando cruza el umbral (no en cada evento de scroll) y no hay
 * `setState` dentro de un efecto. Los tres callbacks viven fuera del
 * componente para que la suscripción nunca se recree.
 */
const ELEVATION_THRESHOLD = 8

function subscribeScroll(onStoreChange: () => void) {
  window.addEventListener('scroll', onStoreChange, { passive: true })
  return () => window.removeEventListener('scroll', onStoreChange)
}

function getScrolled() {
  return window.scrollY > ELEVATION_THRESHOLD
}

// En el servidor (y en el primer render del cliente) el header arranca plano;
// tras hidratar, React compara y aplica la sombra si la página ya venía
// scrolleada, sin hydration mismatch.
function getScrolledOnServer() {
  return false
}

export function CustomerHeader({ fullName }: { fullName: string }) {
  const pathname = usePathname()
  const router = useRouter()
  const items = useCartStore((state) => state.items)
  const itemCount = useMemo(() => cartItemCount(items), [items])
  const initial = fullName.trim().charAt(0).toUpperCase() || '?'
  const [menuOpen, setMenuOpen] = useState(false)
  const [lastPathname, setLastPathname] = useState(pathname)
  const scrolled = useSyncExternalStore(subscribeScroll, getScrolled, getScrolledOnServer)
  if (pathname !== lastPathname) {
    setLastPathname(pathname)
    setMenuOpen(false)
  }

  const search = useSearchStore((s) => s.query)
  const setSearch = useSearchStore((s) => s.setQuery)

  useEffect(() => {
    if (!menuOpen) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [menuOpen])

  function navigate(href: string) {
    if (pathname !== href) {
      router.push(href)
    }
  }

  function handleSearchChange(value: string) {
    setSearch(value)
    // El filtro solo vive en /cliente — si el usuario busca desde otra
    // página del panel, lo llevamos ahí para que vea los resultados.
    if (value.trim() !== '' && pathname !== '/cliente') {
      router.push('/cliente')
    }
  }

  return (
    <>
    <header
      className={cn(
        'sticky top-0 z-40 border-b border-black/5 backdrop-blur-xl backdrop-saturate-150 transition-[background-color,box-shadow] duration-200 ease-client dark:border-white/10',
        scrolled
          ? 'bg-white/90 shadow-client-floating supports-[backdrop-filter]:bg-white/85 dark:bg-neutral-950/85'
          : 'bg-white/70 supports-[backdrop-filter]:bg-white/60 dark:bg-neutral-950/60'
      )}
    >
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-2.5">
        {/* Hamburguesa — móvil y tablet */}
        <button
          type="button"
          onClick={() => setMenuOpen(true)}
          aria-label="Abrir menú"
          aria-expanded={menuOpen}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-black/5 bg-black/[0.03] text-foreground transition-colors hover:bg-black/5 lg:hidden dark:border-white/10 dark:bg-white/5"
        >
          <MenuIcon className="h-4 w-4" />
        </button>

        <Link href="/cliente" className="flex shrink-0 items-center">
          <Logo height={30} />
        </Link>

        {/* Buscador — tablet en adelante */}
        <div className="hidden flex-1 max-w-xs md:block">
          <div className="group relative">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground transition-colors duration-150 group-focus-within:text-brand-500" />
            <input
              type="search"
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Busca un restaurante o plato..."
              className="h-9 w-full rounded-full border border-black/5 bg-black/[0.03] pl-9 pr-4 text-sm outline-none placeholder:text-muted-foreground transition-colors duration-150 focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-500/15 dark:border-white/10 dark:bg-white/5"
            />
          </div>
        </div>

        {/* Nav central — pill glass, solo desktop */}
        <nav className="hidden items-center gap-1 rounded-full border border-black/5 bg-black/[0.03] p-1 backdrop-blur lg:flex dark:border-white/10 dark:bg-white/5">
          {NAV_LINKS.map((link) => {
            const active = pathname === link.href
            return (
              <button
                key={link.href}
                onClick={() => navigate(link.href)}
                className={cn(
                  'flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition-all duration-150',
                  active
                    ? 'bg-gradient-to-r from-brand-500 to-brand-600 text-white shadow-client-card'
                    : 'text-muted-foreground hover:bg-black/5 hover:text-foreground dark:hover:bg-white/10'
                )}
              >
                <link.icon
                  className={cn(
                    'h-3.5 w-3.5 transition-transform duration-150',
                    active && 'scale-110'
                  )}
                />
                {link.label}
              </button>
            )
          })}
        </nav>

        <div className="flex items-center gap-2">
          <Link
            href="/cliente/carrito"
            className={cn(
              'relative flex h-10 w-10 items-center justify-center rounded-full border transition-colors',
              pathname === '/cliente/carrito'
                ? 'border-brand-500 bg-brand-500 text-white'
                : 'border-black/5 bg-black/[0.03] text-foreground hover:bg-black/5 dark:border-white/10 dark:bg-white/5'
            )}
          >
            <ShoppingCartIcon className="h-4 w-4" />
            {itemCount > 0 && (
              // La `key` remonta el badge sólo cuando cambia el número: un
              // re-mount dispara `animate-stat-in` de nuevo y el cliente ve
              // que el producto entró al carrito, no un número que cambia
              // en silencio.
              <span
                key={itemCount}
                className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 animate-stat-in items-center justify-center rounded-full bg-coral px-1 text-[10px] font-bold text-white ring-2 ring-white"
              >
                {itemCount}
              </span>
            )}
          </Link>

          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <button className="rounded-full outline-none" />
              }
            >
              {/* Anillo blanco + hairline: el header es translúcido, así que
                  el avatar necesita despegarse del contenido que pasa por
                  detrás (banners con foto) sin depender del color de fondo. */}
              <Avatar className="h-10 w-10 ring-2 ring-white ring-offset-2 ring-offset-black/10 dark:ring-offset-white/15">
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

      {/* Buscador — celular */}
      <div className="border-t border-black/5 px-4 py-2 md:hidden dark:border-white/10">
        <div className="group relative">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground transition-colors duration-150 group-focus-within:text-brand-500" />
          <input
            type="search"
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Busca un restaurante o plato..."
            className="h-9 w-full rounded-full border border-black/5 bg-black/[0.03] pl-9 pr-4 text-sm outline-none placeholder:text-muted-foreground transition-colors duration-150 focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-500/15 dark:border-white/10 dark:bg-white/5"
          />
        </div>
      </div>
    </header>

    {/* Fondo oscuro al abrir el menú en móvil/tablet */}
      {menuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px] lg:hidden"
          onClick={() => setMenuOpen(false)}
          aria-hidden
        />
      )}

      {/* Panel lateral — móvil y tablet */}
      <aside
        aria-label="Menú de navegación"
        aria-hidden={!menuOpen}
        inert={!menuOpen}
        className={cn(
          'fixed inset-y-0 right-0 z-50 flex h-dvh w-64 flex-col border-l border-black/5 bg-white px-4 py-4 shadow-client-floating transition-transform duration-300 ease-client lg:hidden dark:border-white/10 dark:bg-neutral-950',
          menuOpen ? 'translate-x-0' : 'translate-x-full'
        )}
      >
        <div className="relative flex items-center justify-center py-1">
          <Logo height={26} />
          <button
            type="button"
            onClick={() => setMenuOpen(false)}
            aria-label="Cerrar menú"
            className="absolute right-0 flex h-10 w-10 items-center justify-center rounded-full bg-black/[0.04] text-muted-foreground transition-colors hover:text-foreground dark:bg-white/10"
          >
            <XIcon className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 flex items-center gap-3 rounded-2xl bg-black/[0.03] p-3 dark:bg-white/5">
          <Avatar className="h-10 w-10 ring-1 ring-black/5 dark:ring-white/10">
            <AvatarFallback className="bg-gradient-to-br from-brand-400 to-brand-600 text-sm font-semibold text-white">
              {initial}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{fullName}</p>
            <p className="truncate text-xs text-muted-foreground">Mi cuenta</p>
          </div>
        </div>

        <nav className="mt-4 flex flex-1 flex-col gap-1">
          {NAV_LINKS.map((link) => {
            const active = pathname === link.href
            return (
              <button
                key={link.href}
                type="button"
                onClick={() => navigate(link.href)}
                className={cn(
                  'flex items-center gap-2.5 rounded-2xl px-3 py-2.5 text-sm font-medium transition-colors duration-150',
                  active
                    ? 'bg-gradient-to-r from-brand-500 to-brand-600 text-white shadow-client-card'
                    : 'text-muted-foreground hover:bg-black/5 hover:text-foreground dark:hover:bg-white/10'
                )}
              >
                <link.icon
                  className={cn('h-4 w-4 shrink-0 transition-transform duration-150', active && 'scale-110')}
                />
                {link.label}
              </button>
            )
          })}

          <div className="my-2 h-px bg-black/5 dark:bg-white/10" />

          <button
            type="button"
            onClick={() => navigate('/cliente/perfil')}
            className={cn(
              'flex items-center gap-2.5 rounded-2xl px-3 py-2.5 text-sm font-medium transition-colors duration-150',
              pathname === '/cliente/perfil'
                ? 'bg-gradient-to-r from-brand-500 to-brand-600 text-white shadow-client-card'
                : 'text-muted-foreground hover:bg-black/5 hover:text-foreground dark:hover:bg-white/10'
            )}
          >
            <UserIcon
              className={cn(
                'h-4 w-4 shrink-0 transition-transform duration-150',
                pathname === '/cliente/perfil' && 'scale-110'
              )}
            />
            Mi perfil
          </button>
        </nav>

        <form action={signOut}>
          <button
            type="submit"
            className="flex w-full items-center gap-2.5 rounded-2xl px-3 py-2.5 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10"
          >
            <LogOutIcon className="h-4 w-4 shrink-0" />
            Cerrar sesión
          </button>
        </form>
      </aside>
    </>
  )
}
