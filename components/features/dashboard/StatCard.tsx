import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'

export interface StatCardData {
  title: string
  value: string | number
  icon: LucideIcon
  description?: string
  /**
   * El tono comunica urgencia, no solo decora:
   * "warning"  → requiere acción (ej. restaurantes pendientes de aprobar).
   * "accent"   → LA métrica principal de la vista — resérvalo para una
   *              sola tarjeta por dashboard (ej. "Pedidos hoy"), nunca
   *              para varias a la vez.
   * "default"  → informativo, sin urgencia.
   */
  tone?: 'default' | 'warning' | 'accent'
}
type ToneStyle = { bar: string; chip: string; icon: string; value: string }
const TONE_STYLES: Record<NonNullable<StatCardData['tone']>, ToneStyle> = {
  default: {
    bar: 'bg-border',
    chip: 'bg-muted',
    icon: 'text-muted-foreground',
    value: 'text-foreground',
  },
  warning: {
    bar: 'bg-coral',
    chip: 'bg-coral/10 dark:bg-coral/15',
    icon: 'text-coral',
    value: 'text-coral',
  },
  accent: {
    bar: 'bg-lime',
    chip: 'bg-lime',
    icon: 'text-[#0C0C0E]',
    value: 'text-foreground',
  },
}

/**
 * Tarjeta de estadística usada en los dashboards de Admin, Restaurante y
 * Repartidor. Cambia de "tarjeta gris con icono suelto" a un chip de
 * icono con color semántico + una barra de acento superior — el mismo
 * componente ahora también comunica prioridad, no solo el número.
 */
export function StatCard({
  title,
  value,
  icon: Icon,
  description,
  tone = 'default',
}: StatCardData) {
  const styles = TONE_STYLES[tone]

  return (
    <Card className="relative overflow-hidden">
      <span className={cn('absolute inset-x-0 top-0 h-1', styles.bar)} aria-hidden />
      <CardHeader className="flex flex-row items-start justify-between gap-3 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <span
          className={cn(
            'flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl',
            styles.chip
          )}
        >
          <Icon className={cn('h-4 w-4', styles.icon)} />
        </span>
      </CardHeader>
      <CardContent>
        <div
          className={cn(
            'text-3xl font-bold tracking-tight tabular-nums',
            styles.value
          )}
        >
          {value}
        </div>
        {description && (
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        )}
      </CardContent>
    </Card>
  )
}

/** Grilla responsiva estándar para un set de StatCards, con una entrada
 * escalonada única al montar (no hover shimmer en cada tarjeta — un solo
 * momento orquestado, no efectos repetidos). */
export function StatCardGrid({ cards }: { cards: StatCardData[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card, index) => (
        <div
          key={card.title}
          className="animate-stat-in [animation-fill-mode:backwards]"
          style={{ animationDelay: `${index * 60}ms` }}
        >
          <StatCard {...card} />
        </div>
      ))}
    </div>
  )
}