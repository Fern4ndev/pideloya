import { cn } from '@/lib/utils'

/**
 * Contenedor estándar de las tablas de panel: el mismo borde redondeado
 * que ya usaba restaurante, aplicado a admin y repartidor para que las
 * tres tablas se vean idénticas (antes: suelta / div / Card con título).
 */
export function TableShell({
  className,
  children,
}: {
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={cn('overflow-hidden rounded-2xl border', className)}>
      {children}
    </div>
  )
}
