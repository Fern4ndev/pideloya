import { Sidebar } from './Sidebar'

const DELIVERY_LINKS = [
  { href: '/repartidor', label: 'Dashboard' },
  { href: '/repartidor/disponibles', label: 'Disponibles' },
  { href: '/repartidor/pedidos', label: 'Mis entregas' },
  { href: '/repartidor/perfil', label: 'Perfil' },
]

export function DeliverySidebar() {
  return (
    <Sidebar
      brand={<>PideloYa <span className="text-muted-foreground">· Reparto</span></>}
      homeHref="/repartidor"
      links={DELIVERY_LINKS}
    />
  )
}
