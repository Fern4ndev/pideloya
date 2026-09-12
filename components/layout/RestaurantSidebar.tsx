import { Sidebar } from './Sidebar'

const RESTAURANT_LINKS = [
  { href: '/restaurante', label: 'Dashboard' },
  { href: '/restaurante/productos', label: 'Productos' },
  { href: '/restaurante/categorias', label: 'Categorías' },
  { href: '/restaurante/negocio', label: 'Mi negocio' },
  { href: '/restaurante/perfil', label: 'Perfil' },
]

export function RestaurantSidebar() {
  return (
    <Sidebar
      brand={<>PideloYa <span className="text-muted-foreground">· Negocio</span></>}
      homeHref="/restaurante"
      links={RESTAURANT_LINKS}
    />
  )
}
