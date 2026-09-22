'use client'

import { Sidebar } from './Sidebar'
import {
  LayoutDashboardIcon,
  MapPinIcon,
  PackageIcon,
  HistoryIcon,
  UserIcon,
} from 'lucide-react'

const DELIVERY_LINKS = [
  { href: '/repartidor', label: 'Dashboard', icon: LayoutDashboardIcon },
  { href: '/repartidor/disponibles', label: 'Disponibles', icon: MapPinIcon },
  { href: '/repartidor/pedidos', label: 'Mis entregas', icon: PackageIcon },
  { href: '/repartidor/historial', label: 'Historial', icon: HistoryIcon },
  { href: '/repartidor/perfil', label: 'Perfil', icon: UserIcon },
]

export function DeliverySidebar({ fullName }: { fullName?: string }) {
  return (
    <Sidebar
      section="Reparto"
      homeHref="/repartidor"
      links={DELIVERY_LINKS}
      fullName={fullName}
    />
  )
}