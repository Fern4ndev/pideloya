'use client'

import { Sidebar } from './Sidebar'
import {
  LayoutDashboardIcon,
  ScrollTextIcon,
  StoreIcon,
  Motorbike,
  UsersIcon,
  UserIcon,
  HandCoinsIcon,
} from 'lucide-react'

const ADMIN_LINKS = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboardIcon },
  { href: '/admin/restaurantes', label: 'Restaurantes', icon: StoreIcon },
  { href: '/admin/repartidores', label: 'Repartidores', icon: Motorbike },
  { href: '/admin/usuarios', label: 'Usuarios', icon: UsersIcon },
  { href: '/admin/pagos', label: 'Pagos', icon: HandCoinsIcon },
  { href: '/admin/auditoria', label: 'Auditoría', icon: ScrollTextIcon },
  { href: '/admin/perfil', label: 'Perfil', icon: UserIcon },
]

export function AdminSidebar({
  fullName,
  pendingRestaurants = 0,
  pendingDeliveries = 0,
  openPaymentIncidents = 0,
}: {
  fullName?: string
  /** Pendientes de aprobación, contados en el layout (Fase 10). */
  pendingRestaurants?: number
  pendingDeliveries?: number
  /** Incidencias de pago abiertas (Fase 8 del plan "Pagar al recibir"). */
  openPaymentIncidents?: number
}) {
  // Los badges se inyectan aquí en vez de vivir dentro de ADMIN_LINKS: el
  // orden del menú sigue siendo una sola lista, y los conteos llegan del
  // servidor (cero fetching en el cliente).
  const links = ADMIN_LINKS.map((link) =>
    link.href === '/admin/restaurantes'
      ? {
          ...link,
          badge: { count: pendingRestaurants, label: 'pendientes de aprobación' },
        }
      : link.href === '/admin/repartidores'
        ? {
            ...link,
            badge: { count: pendingDeliveries, label: 'pendientes de aprobación' },
          }
        : link.href === '/admin/pagos'
          ? {
              ...link,
              badge: { count: openPaymentIncidents, label: 'incidencias de pago abiertas' },
            }
          : link
  )

  return (
    <Sidebar
      section="Admin"
      homeHref="/admin"
      links={links}
      fullName={fullName}
    />
  )
}