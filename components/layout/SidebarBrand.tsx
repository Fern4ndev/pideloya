import Image from 'next/image'
import { cn } from '@/lib/utils'

/**
 * Logo + etiqueta de sección, usado como `brand` en cada Sidebar
 * (Admin, Restaurante, Repartidor). Centraliza el logo en un solo
 * lugar: si cambia el archivo o el tamaño, se cambia aquí una vez.
 */
export function SidebarBrand({
  section,
  className,
}: {
  /** Texto corto que identifica el panel, ej. "Negocio", "Reparto" */
  section?: string
  className?: string
}) {
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