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
      <Image
        src="/icons/favicon.svg"
        width={20}
        height={20}
        alt="PideloYa"
        className={cn('h-5 w-auto shrink-0', className)}
        style={{ width: 'auto', height: '1.5rem' }}
      />
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