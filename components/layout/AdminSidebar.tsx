'use client'

import { Sidebar } from './Sidebar'
import { LayoutDashboardIcon, StoreIcon, Motorbike, UserIcon } from 'lucide-react'

const ADMIN_LINKS = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboardIcon },
  { href: '/admin/restaurantes', label: 'Restaurantes', icon: StoreIcon },
  { href: '/admin/repartidores', label: 'Repartidores', icon: Motorbike },
  { href: '/admin/perfil', label: 'Perfil', icon: UserIcon },
]

export function AdminSidebar({ fullName }: { fullName?: string }) {
  return (
    <Sidebar
      section="Admin"
      homeHref="/admin"
      links={ADMIN_LINKS}
      fullName={fullName}
    />
  )
}