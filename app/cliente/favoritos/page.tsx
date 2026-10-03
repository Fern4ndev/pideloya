import { HeartIcon } from 'lucide-react'
import { EmptyState } from '@/components/ui/empty-state'

export default function FavoritosPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Favoritos</h1>
      {/* La funcionalidad de favoritos todavía no existe (no hay tabla ni
          acción): hasta que se implemente, la página dice qué es y qué hará
          en vez de quedar como un título suelto. */}
      <EmptyState
        icon={HeartIcon}
        title="Aún no tienes favoritos"
        description="Marca tus restaurantes preferidos para encontrarlos más rápido."
        className="mt-10 rounded-3xl"
      />
    </div>
  )
}
