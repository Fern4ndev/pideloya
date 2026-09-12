'use client'

import { Sidebar } from './Sidebar'
import { SidebarBrand } from './SidebarBrand'
import { LayoutDashboardIcon, StoreIcon, Motorbike, UserIcon } from 'lucide-react'

const ADMIN_LINKS = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboardIcon },
  { href: '/admin/restaurantes', label: 'Restaurantes', icon: StoreIcon },
  { href: '/admin/repartidores', label: 'Repartidores', icon: Motorbike },
  { href: '/admin/perfil', label: 'Perfil', icon: UserIcon },
]

export function AdminSidebar() {
  return (
    <Sidebar
      brand={<SidebarBrand section="Admin" />}
      homeHref="/admin"
      links={ADMIN_LINKS}
    />
  )
}