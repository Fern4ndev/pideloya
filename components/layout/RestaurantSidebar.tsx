'use client'

import { Sidebar } from './Sidebar'
import { SidebarBrand } from './SidebarBrand'
import {
  LayoutDashboardIcon,
  PackageIcon,
  TagsIcon,
  StoreIcon,
  ClockIcon,
  UserIcon,
} from 'lucide-react'

const RESTAURANT_LINKS = [
  { href: '/restaurante', label: 'Dashboard', icon: LayoutDashboardIcon },
  { href: '/restaurante/productos', label: 'Productos', icon: PackageIcon },
  { href: '/restaurante/categorias', label: 'Categorías', icon: TagsIcon },
  { href: '/restaurante/negocio', label: 'Mi negocio', icon: StoreIcon },
  { href: '/restaurante/horarios', label: 'Horarios', icon: ClockIcon },
  { href: '/restaurante/perfil', label: 'Perfil', icon: UserIcon },
]

export function RestaurantSidebar() {
  return (
    <Sidebar
      brand={<SidebarBrand section="Negocio" />}
      homeHref="/restaurante"
      links={RESTAURANT_LINKS}
    />
  )
}