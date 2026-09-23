'use client'

import { Sidebar } from './Sidebar'
import {
  LayoutDashboardIcon,
  ShoppingBagIcon,
  PackageIcon,
  TagsIcon,
  StoreIcon,
  ClockIcon,
  UserIcon,
} from 'lucide-react'

const RESTAURANT_LINKS = [
  { href: '/restaurante', label: 'Dashboard', icon: LayoutDashboardIcon },
  { href: '/restaurante/pedidos', label: 'Pedidos', icon: ShoppingBagIcon },
  { href: '/restaurante/productos', label: 'Productos', icon: PackageIcon },
  { href: '/restaurante/categorias', label: 'Categorías', icon: TagsIcon },
  { href: '/restaurante/negocio', label: 'Mi negocio', icon: StoreIcon },
  { href: '/restaurante/horarios', label: 'Horarios', icon: ClockIcon },
  { href: '/restaurante/perfil', label: 'Perfil', icon: UserIcon },
]

export function RestaurantSidebar({ fullName }: { fullName?: string }) {
  return (
    <Sidebar
      section="Negocio"
      homeHref="/restaurante"
      links={RESTAURANT_LINKS}
      fullName={fullName}
    />
  )
}