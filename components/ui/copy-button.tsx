'use client'

import { useEffect, useRef, useState } from 'react'
import { CheckIcon, CopyIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import { cn } from '@/lib/utils'

/**
 * Copia `value` al portapapeles en contextos donde la API moderna no existe.
 *
 * `navigator.clipboard` exige un contexto seguro (https o localhost). Durante
 * el desarrollo en red local (`http://192.168.x.x`) y en WebViews antiguos
 * —plausibles en los celulares de los clientes— no está disponible, y sin este
 * respaldo el botón simplemente no haría nada. El `<textarea>` temporal con
 * `execCommand('copy')` es la técnica vieja, deprecada pero universal.
 *
 * La API moderna NO se da por buena solo porque exista: se espera su promesa y,
 * si rechaza, se sigue al respaldo. Rechaza por cosas que no tienen nada que ver
 * con "no hay portapapeles" —el documento sin foco (una pestaña en segundo
 * plano, un clic que dispara desde un elemento que no tiene el foco), una
 * política de permisos heredada del iframe o del WebView—, y en todos esos casos
 * el camino viejo sí funciona. Sin este `try`, el botón le diría al usuario "no
 * se pudo copiar" teniendo el respaldo a mano.
 */
async function writeClipboard(text: string) {
  if (navigator.clipboard?.writeText && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text)
      return
    } catch {
      // Se intenta el respaldo antes de rendirse (ver arriba).
    }
  }

  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', '')
  // Fuera de la vista pero dentro del layout: `display: none` o `visibility:
  // hidden` harían que la selección no se pueda establecer en algunos
  // navegadores, y el copy fallaría.
  textarea.style.position = 'fixed'
  textarea.style.top = '0'
  textarea.style.opacity = '0'
  document.body.appendChild(textarea)
  textarea.select()
  const ok = document.execCommand('copy')
  document.body.removeChild(textarea)
  if (!ok) throw new Error('copy failed')
}

/**
 * Botón de copiar al portapapeles con feedback en el punto exacto donde el
 * usuario tocó.
 *
 * Tres decisiones que no son cosméticas:
 *
 * 1. **El feedback es el ícono (Copy → Check), no un toast.** En un celular un
 *    toast arriba de la pantalla puede quedar fuera de la vista justo cuando el
 *    usuario mira el botón que acaba de pulsar. El toast queda reservado para
 *    el ERROR, que sí es un caso que necesita explicación.
 * 2. **40×40 px** de objetivo táctil (`h-10 w-10 p-0` en vez del `sm` por
 *    defecto; se usa la variante por defecto y se neutraliza su padding porque
 *    `twMerge` no elimina `size-8` al pasar `h-10 w-10`).
 * 3. **No depende del color:** el estado copiado cambia el ÍCONO y el color a
 *    la vez. Un daltonismo no pierde la confirmación, y quien no la ve igual
 *    tiene la región `aria-live` de abajo.
 *
 * El componente es genérico a propósito (no sabe del repartidor): mañana sirve
 * para copiar el monto o el código del pedido sin tocar nada.
 */
export function CopyButton({
  value,
  label,
  className,
}: {
  /** Texto exacto que se copia (sin formato de presentación). */
  value: string
  /** Nombre del dato, para las etiquetas accesibles: "Copiar {label}". */
  label: string
  className?: string
}) {
  const [copied, setCopied] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const { error } = useToast()

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    },
    []
  )

  async function handleCopy() {
    try {
      await writeClipboard(value)
      setCopied(true)
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => setCopied(false), 2000)
    } catch {
      // Sin `navigator.clipboard` roto: se le dice al usuario la alternativa
      // que siempre funciona (seleccionar y mantener presionado), en vez de
      // dejarlo sin saber qué pasó.
      error('No se pudo copiar', 'Mantén presionado el número para copiarlo.')
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={handleCopy}
        aria-label={copied ? `${label} copiado` : `Copiar ${label}`}
        className={cn(
          'h-10 w-10 shrink-0 rounded-xl p-0',
          copied && 'border-emerald-500/50 text-emerald-700 dark:text-emerald-400',
          className
        )}
      >
        {copied ? <CheckIcon aria-hidden /> : <CopyIcon aria-hidden />}
      </Button>
      {/* El cambio de ícono es solo visual: los lectores de pantalla necesitan
          este anuncio explícito (mismo dato que el aria-label del botón, que
          solo se lee al enfocar). */}
      <span role="status" aria-live="polite" className="sr-only">
        {copied ? `${label} copiado` : ''}
      </span>
    </>
  )
}
