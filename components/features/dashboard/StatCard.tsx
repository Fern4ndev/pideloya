import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'

export interface StatCardData {
  title: string
  value: string | number
  icon: LucideIcon
  description?: string
  /** "warning" resalta el número en ámbar — úsalo para cosas que
   * requieren acción, ej. "restaurantes pendientes de aprobar". */
  tone?: 'default' | 'warning'
}

/**
 * Tarjeta de estadística usada en los dashboards de Admin y
 * Restaurante (y cualquier panel futuro). Antes cada panel definía su
 * propia versión idéntica de esta tarjeta — ahora solo cambian los
 * datos que le pasa cada dashboard, no el componente.
 */
export function StatCard({ title, value, icon: Icon, description, tone = 'default' }: StatCardData) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <Icon
          className={cn(
            'h-4 w-4',
            tone === 'warning' ? 'text-amber-500' : 'text-muted-foreground'
          )}
        />
      </CardHeader>
      <CardContent>
        <div
          className={cn(
            'text-2xl font-bold',
            tone === 'warning' && 'text-amber-600 dark:text-amber-500'
          )}
        >
          {value}
        </div>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </CardContent>
    </Card>
  )
}

/** Grilla responsiva estándar para un set de StatCards. */
export function StatCardGrid({ cards }: { cards: StatCardData[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <StatCard key={card.title} {...card} />
      ))}
    </div>
  )
}