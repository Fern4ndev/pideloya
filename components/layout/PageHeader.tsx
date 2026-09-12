import { cn } from '@/lib/utils'

/**
 * Encabezado estándar para cualquier página de panel (cliente,
 * restaurante, repartidor o admin). Mantiene consistente el título,
 * la descripción y, si hace falta, un botón de acción a la derecha
 * (ej. "Nuevo producto").
 */
export function PageHeader({
  title,
  description,
  action,
  className,
}: {
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between',
        className
      )}
    >
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}