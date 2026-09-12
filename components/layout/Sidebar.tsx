'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from '@/lib/actions/auth'
import { Button } from '@/components/ui/button'
import { LogOutIcon } from 'lucide-react'

type SidebarLink = {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
}

export function Sidebar({
  brand,
  homeHref,
  links,
}: {
  brand: React.ReactNode
  homeHref: string
  links: SidebarLink[]
}) {
  const pathname = usePathname()

  return (
    <aside className="flex h-screen w-56 shrink-0 flex-col border-r bg-background px-3 py-4">
      <Link
        href={homeHref}
        className="px-2 pb-4 text-base font-semibold tracking-tight"
      >
        {brand}
      </Link>

      <nav className="flex flex-1 flex-col gap-1">
        {links.map((link) => {
          const active = pathname === link.href
          const Icon = link.icon
          return (
            <Button
              key={link.href}
              render={<Link href={link.href} />}
              nativeButton={false}
              variant={active ? 'default' : 'ghost'}
              size="sm"
              className="justify-start gap-2"
            >
              <Icon className="h-4 w-4" />
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
          className="w-full justify-start gap-2"
        >
          <LogOutIcon className="h-4 w-4" />
          Cerrar sesión
        </Button>
      </form>
    </aside>
  )
}
