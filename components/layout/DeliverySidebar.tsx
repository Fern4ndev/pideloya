'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from '@/lib/actions/auth'
import { Button } from '@/components/ui/button'

const NAV_LINKS = [
  { href: '/repartidor', label: 'Dashboard' },
  { href: '/repartidor/disponibles', label: 'Disponibles' },
  { href: '/repartidor/pedidos', label: 'Mis entregas' },
  { href: '/repartidor/perfil', label: 'Perfil' },
]

export function DeliverySidebar() {
  const pathname = usePathname()

  return (
    <aside className="flex h-screen w-56 shrink-0 flex-col border-r bg-background px-3 py-4">
      <Link
        href="/repartidor"
        className="px-2 pb-4 text-base font-semibold tracking-tight"
      >
        PideloYa <span className="text-muted-foreground">· Reparto</span>
      </Link>

      <nav className="flex flex-1 flex-col gap-1">
        {NAV_LINKS.map((link) => {
          const active = pathname === link.href
          return (
            <Button
              key={link.href}
              render={<Link href={link.href} />}
              nativeButton={false}
              variant={active ? 'default' : 'ghost'}
              size="sm"
              className="justify-start"
            >
              {link.label}
            </Button>
          )
        })}
      </nav>

      <form action={signOut}>
        <Button
          type="submit"
          variant="ghost"
          size="sm"
          className="w-full justify-start"
        >
          Cerrar sesión
        </Button>
      </form>
    </aside>
  )
}