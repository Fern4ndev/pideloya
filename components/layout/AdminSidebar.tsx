import Image from 'next/image'
import { Sidebar } from './Sidebar'

const ADMIN_LINKS = [
  { href: '/admin', label: 'Dashboard' },
  { href: '/admin/restaurantes', label: 'Restaurantes' },
  { href: '/admin/repartidores', label: 'Repartidores' },
  { href: '/admin/perfil', label: 'Perfil' },
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
