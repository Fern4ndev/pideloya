'use client'

import { Sidebar } from './Sidebar'
import { SidebarBrand } from './SidebarBrand'
import { LayoutDashboardIcon, MapPinIcon, PackageIcon, UserIcon } from 'lucide-react'

const DELIVERY_LINKS = [
  { href: '/repartidor', label: 'Dashboard', icon: LayoutDashboardIcon },
  { href: '/repartidor/disponibles', label: 'Disponibles', icon: MapPinIcon },
  { href: '/repartidor/pedidos', label: 'Mis entregas', icon: PackageIcon },
  { href: '/repartidor/perfil', label: 'Perfil', icon: UserIcon },
]

export function DeliverySidebar() {
  return (
    <Sidebar
      brand={<SidebarBrand section="Reparto" />}
      homeHref="/repartidor"
      links={DELIVERY_LINKS}
    />
  )
}