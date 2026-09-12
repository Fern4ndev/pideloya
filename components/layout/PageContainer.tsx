import { cn } from '@/lib/utils'

const MAX_WIDTHS = {
  // Formularios cortos: perfil, categorías, mi negocio
  sm: 'max-w-md',
  // Formularios con más campos: producto, horarios
  md: 'max-w-xl',
  // Listados y tablas
  lg: 'max-w-4xl',
  full: 'max-w-none',
} as const

/**
 * Centra el contenido de una página de panel dentro del área principal
 * (que ya trae su propio padding desde el layout). Usar el mismo `size`
 * en páginas similares mantiene el ancho del contenido consistente en
 * todo el panel.
 */
export function PageContainer({
  size = 'md',
  className,
  children,
}: {
  size?: keyof typeof MAX_WIDTHS
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={cn('mx-auto w-full', MAX_WIDTHS[size], className)}>
      {children}
    </div>
  )
}