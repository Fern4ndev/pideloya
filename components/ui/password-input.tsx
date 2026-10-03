'use client'

import { useState } from 'react'
import { EyeIcon, EyeOffIcon } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

/**
 * Input de contraseña con botón para mostrar/ocultar.
 *
 * El botón SÍ queda en el orden de tabulación (a diferencia del
 * `PasswordField` del registro, que lo saca con `tabIndex={-1}`):
 * alternar la visibilidad es funcionalidad, y toda funcionalidad debe ser
 * alcanzable por teclado. Quien no ve la pantalla no debería depender del
 * mouse para comprobar qué escribió. El foco se ve con el outline lima
 * global de `:focus-visible` (app/globals.css), así que no hace falta
 * ningún estilo de foco adicional aquí.
 */
export function PasswordInput({
  className,
  ...props
}: Omit<React.ComponentProps<typeof Input>, 'type'>) {
  const [visible, setVisible] = useState(false)

  return (
    <div className="relative">
      <Input
        type={visible ? 'text' : 'password'}
        className={cn('pr-10', className)}
        {...props}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="absolute top-1/2 right-1.5 flex size-7 -translate-y-1/2 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
      >
        {visible ? (
          <EyeOffIcon className="size-4" aria-hidden="true" />
        ) : (
          <EyeIcon className="size-4" aria-hidden="true" />
        )}
      </button>
    </div>
  )
}
