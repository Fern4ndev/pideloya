import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'

/**
 * Empty state estándar de los paneles: bloque dashed con icono opcional,
 * título, descripción y (opcional) una acción. Reemplaza los 6 patrones
 * distintos que había (texto plano en admin, bloques hand-rolled en
 * restaurante/repartidor).
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-6 py-14 text-center',
        className
      )}
    >
      {Icon && <Icon className="h-8 w-8 text-muted-foreground/50" aria-hidden />}
      <p className="font-medium">{title}</p>
      {description && (
        <p className="max-w-xs text-sm text-muted-foreground">{description}</p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}
