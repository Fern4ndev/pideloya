import { cn } from '@/lib/utils'

const MAX_WIDTHS = {
  /** Formularios y detalle enfocado en una sola columna (perfil, dirección). */
  narrow: 'max-w-lg',
  /** Contenido con posible layout de 2 columnas en desktop (detalle de pedido). */
  wide: 'max-w-4xl',
} as const

/*
 * Convención de espaciado entre secciones del panel de cliente
 * (plan-tarifa-libre-repartidor-y-pulido-panel-cliente.md, Fase 2.1):
 *
 * | Nivel                                                   | Clase                  |
 * |---------------------------------------------------------|------------------------|
 * | Dentro de una tarjeta (header → contenido, filas)       | space-y-3 / gap-3      |
 * | Entre tarjetas hermanas de una misma sección            | space-y-4 / gap-4      |
 * | Entre secciones grandes de una página                   | space-y-8 sm:space-y-10|
 *
 * Única excepción consciente: la lista de pedidos usa space-y-3 entre
 * tarjetas por densidad de lista (son más compactas que las del detalle).
 * Antes de inventar un `mt-*` suelto, buscar el nivel en esta tabla.
 */

/**
 * Contenedor estándar de una página del panel de cliente. Mismo propósito
 * que PageContainer (admin/restaurante/repartidor): centraliza el ancho
 * máximo para que las páginas dejen de definir cada una el suyo a mano.
 */
export function ClientPageContainer({
  size = 'narrow',
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
