'use client'

import { cn } from '@/lib/utils'
import {
  PAYMENT_METHOD_COPY,
  type PaymentMethod,
} from '@/lib/constants/payment-method'

/**
 * Elección de cómo paga el cliente el envío. Componente CONTROLADO y sin
 * estado propio: el padre es dueño de `value` y decide qué panel se muestra
 * debajo. Así la elección y sus consecuencias (qué CTA aparece) no pueden
 * desincronizarse.
 *
 * Por qué radios NATIVOS (`<input type="radio">`) y no un componente de
 * librería: las flechas del teclado, la agrupación por `name`, el anuncio
 * "opción 1 de 2" y el foco por grupo son comportamiento del NAVEGADOR. Un
 * div con role="radio" obliga a reimplementarlos y a mantenerlos.
 *
 * Decisiones que no son cosméticas:
 *
 * 1. El `<input>` va `sr-only` (no `hidden`): `display:none` lo saca del árbol
 *    de accesibilidad y deja la elección fuera del alcance de un lector de
 *    pantalla. Como el input es invisible, el anillo de foco hay que pintarlo
 *    en la tarjeta visible con `peer-focus-visible:` — sin eso, navegar con
 *    Tab no muestra dónde está el foco (la regla global `:focus-visible` se
 *    dibujaría sobre un elemento de 1×1 px recortado).
 * 2. La opción seleccionada NO se distingue solo por color: cambia el borde, el
 *    fondo y se rellena el círculo interior. Con daltonismo o en una pantalla
 *    al sol, el color solo no alcanza.
 * 3. El círculo interior se decide por JS (`value === m`) y no con
 *    `peer-checked:`: la variante `peer-*` de Tailwind aplica a HERMANOS
 *    siguientes del input, no a un span anidado dentro de ellos.
 * 4. El objetivo táctil es la tarjeta completa (`min-h-14` = 56 px), no el
 *    círculo de 20 px.
 *
 * Contraste MEDIDO (Fase 8 del plan, no estimado), con las matrices de CSS
 * Color 4 sobre los tokens reales de Tailwind y `--background`:
 *
 *   - círculo VACÍO: `black/25` daba 1.83:1 y `white/30` en oscuro 2.70:1 —
 *     ambos bajo el 3:1 que 1.4.11 pide para el límite de un control. Ahora
 *     `black/45` = 3.35:1 y `white/45` = 4.32:1.
 *   - borde de la tarjeta ELEGIDA: `amber-500` daba 2.15:1 sobre blanco; ahora
 *     `amber-600` = 3.19:1 (en oscuro `amber-400/70` ya estaba en 5.64:1).
 *   - el texto de la opción no depende de eso: el título es `foreground`
 *     (18.55:1 sobre el fondo ámbar de la opción elegida) y el subtítulo
 *     `amber-900`/`amber-100`.
 * 5. `disabled` va en el `<fieldset>`: deshabilita el grupo entero y lo saca
 *    del orden de tabulación de una sola vez, mientras el padre está subiendo
 *    un comprobante. Cambiar de método a mitad de una subida dejaría la
 *    promesa en vuelo sin UI que la espere.
 */
export function PaymentMethodChoice({
  value,
  onChange,
  disabled = false,
}: {
  value: PaymentMethod | null
  onChange: (method: PaymentMethod) => void
  disabled?: boolean
}) {
  return (
    <fieldset disabled={disabled} className="min-w-0">
      <legend className="text-sm font-medium">¿Cómo quieres pagar el envío?</legend>
      <div className="mt-3 space-y-2">
        {(['CASH', 'YAPE'] as const).map((method) => {
          const selected = value === method
          return (
            <label key={method} className="block cursor-pointer">
              <input
                type="radio"
                name="payment-method"
                value={method}
                checked={selected}
                onChange={() => onChange(method)}
                className="peer sr-only"
              />
              <span
                className={cn(
                  'flex min-h-14 items-start gap-3 rounded-2xl border p-3 transition-colors',
                  'border-black/10 bg-white dark:border-white/10 dark:bg-white/5',
                  'peer-checked:border-amber-600 peer-checked:bg-amber-100/60',
                  'dark:peer-checked:border-amber-400/70 dark:peer-checked:bg-amber-500/15',
                  'peer-focus-visible:outline peer-focus-visible:outline-2',
                  'peer-focus-visible:outline-offset-1 peer-focus-visible:outline-lime',
                  'peer-disabled:cursor-default peer-disabled:opacity-70'
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2',
                    selected
                      ? 'border-amber-600 dark:border-amber-400'
                      : 'border-black/45 dark:border-white/45'
                  )}
                >
                  <span
                    className={cn(
                      'h-2.5 w-2.5 rounded-full',
                      selected ? 'bg-amber-600 dark:bg-amber-400' : 'bg-transparent'
                    )}
                  />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium">
                    {PAYMENT_METHOD_COPY[method].title}
                  </span>
                  {/* amber-900 (≈9:1 sobre blanco y ≈8:1 sobre amber-100) en vez
                      de `muted-foreground`, que sobre el fondo ámbar de la
                      opción elegida queda sin margen. */}
                  <span className="mt-0.5 block text-xs text-amber-900 dark:text-amber-100">
                    {PAYMENT_METHOD_COPY[method].subtitle}
                  </span>
                </span>
              </span>
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}
