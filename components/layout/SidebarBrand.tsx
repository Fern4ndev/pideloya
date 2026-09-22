import Image from 'next/image'
import { cn } from '@/lib/utils'

export function SidebarBrand({
  section,
  collapsed = false,
  className,
}: {
  /** Texto corto que identifica el panel, ej. "Negocio", "Reparto" */
  section?: string
  /** Versión compacta (solo inicial) para cuando el sidebar está colapsado */
  collapsed?: boolean
  className?: string
}) {
  if (collapsed) {
    return (
      <span
        className={cn(
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-sm font-bold text-primary-foreground',
          className
        )}
      >
        P
      </span>
    )
  }

  return (
    <span className={cn('flex flex-col items-center gap-0.5', className)}>
      <Image
        src="/icons/logo-pideloya.svg"
        width={140}
        height={36}
        alt="PideloYa"
        className="h-9 w-auto"
        style={{ width: 'auto', height: '2.25rem' }}
        priority
      />
      {section && (
        <span className="translate-y-px text-sm font-medium text-muted-foreground">
          {section}
        </span>
      )}
    </span>
  )
}