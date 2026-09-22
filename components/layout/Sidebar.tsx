'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from '@/lib/actions/auth'
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
import { SidebarBrand } from './SidebarBrand'
import { ChevronLeftIcon, ChevronRightIcon, LogOutIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

type SidebarLink = {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
}

export function Sidebar({
  section,
  homeHref,
  links,
  fullName = 'Usuario',
}: {
  /** Texto corto del panel, ej. "Admin", "Negocio", "Reparto" — se lo pasa a SidebarBrand */
  section?: string
  homeHref: string
  links: SidebarLink[]
  /** Nombre del usuario logueado, mostrado debajo del sidebar */
  fullName?: string
}) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const initial = fullName.trim().charAt(0).toUpperCase() || '?'

  return (
    <aside
      className={cn(
        'relative flex h-screen shrink-0 flex-col border-r bg-background py-4 transition-[width] duration-200',
        collapsed ? 'w-[72px] px-2' : 'w-60 px-3'
      )}
    >
      {/* Botón para colapsar/expandir el sidebar */}
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        className="absolute -right-3 top-8 z-10 flex h-6 w-6 items-center justify-center rounded-full border bg-background text-muted-foreground shadow-sm transition-colors hover:text-foreground"
        aria-label={collapsed ? 'Expandir menú' : 'Colapsar menú'}
      >
        {collapsed ? (
          <ChevronRightIcon className="h-3.5 w-3.5" />
        ) : (
          <ChevronLeftIcon className="h-3.5 w-3.5" />
        )}
      </button>

      <Link
        href={homeHref}
        className={cn('flex items-center pb-4', collapsed ? 'justify-center px-0' : 'px-2')}
      >
        <SidebarBrand section={section} collapsed={collapsed} />
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
              title={collapsed ? link.label : undefined}
              className={cn('gap-2', collapsed ? 'justify-center px-0' : 'justify-start')}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {!collapsed && link.label}
            </Button>
          )
        })}
      </nav>

      {/* Usuario + menú de cerrar sesión, en vez del botón suelto de antes */}
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button
              type="button"
              className={cn(
                'flex w-full items-center gap-2 rounded-2xl p-2 text-left transition-colors hover:bg-muted',
                collapsed && 'justify-center'
              )}
            />
          }
        >
          <Avatar size="sm" className="shrink-0">
            <AvatarFallback className="bg-primary text-primary-foreground">
              {initial}
            </AvatarFallback>
          </Avatar>
          {!collapsed && (
            <span className="min-w-0 flex-1 truncate text-sm font-medium">
              {fullName}
            </span>
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" side="top" className="w-52">
          <DropdownMenuGroup>
            <DropdownMenuLabel className="truncate text-xs font-normal text-muted-foreground">
              {fullName}
            </DropdownMenuLabel>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={() => setConfirmOpen(true)}>
            <LogOutIcon className="h-4 w-4" />
            Cerrar sesión
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Cerrar sesión?</AlertDialogTitle>
            <AlertDialogDescription>
              Tu sesión se cerrará y serás redirigido al inicio.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => signOut()}>
              Cerrar sesión
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </aside>
  )
}