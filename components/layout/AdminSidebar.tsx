'use client'

import Image from 'next/image'
import { Sidebar } from './Sidebar'
import { LayoutDashboardIcon, StoreIcon, Motorbike , UserIcon } from 'lucide-react'

const ADMIN_LINKS = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboardIcon },
  { href: '/admin/restaurantes', label: 'Restaurantes', icon: StoreIcon },
  { href: '/admin/repartidores', label: 'Repartidores', icon: Motorbike },
  { href: '/admin/perfil', label: 'Perfil', icon: UserIcon },
]

export function AdminSidebar() {
  return (
    <Sidebar
      brand={<Image src="/icons/logo-pideloya.svg" width={160} height={40} alt="logo-pideloya" />}
      homeHref="/admin"
      links={ADMIN_LINKS}
    />
  )
}
