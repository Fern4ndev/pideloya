'use client'

import { cn } from '@/lib/utils'
import { PAYMENT_TIMING_COPY, type PaymentTiming } from '@/lib/constants/payment-method'

/**
 * Elección de pago del cliente, en UN nivel: `Pagar ahora` (UPFRONT: Yape +
 * comprobante) o `Pagar al recibir`.
 *
 * Antes eran dos niveles — el segundo preguntaba con qué paga quien elige "al
 * recibir" (efectivo o Yape) — y ese método terminaba siendo una promesa que el
 * repartidor volvía a declarar en la puerta para que el sistema comparara una
 * contra otra. Nadie consumía el dato: el repartidor cobra con lo que el
 * cliente le entregue, así que con ON_DELIVERY `payment_method` queda NULL (ver
 * la migración 20261003100000). Preguntarlo era pedir trabajo que no se usa.
 *
 * Componente CONTROLADO y sin estado propio: el padre es dueño de `timing`, así
 * que la elección y sus consecuencias (qué CTA aparece) no pueden
 * desincronizarse.
 *
 * Por qué radios NATIVOS (`<input type="radio">`): las flechas del teclado, la
 * agrupación por `name`, el anuncio "opción 1 de 2" y el foco por grupo son
 * comportamiento del NAVEGADOR; un div con role="radio" obligaría a
 * reimplementarlos.
 *
 * Decisiones que no son cosméticas:
 *
 * 1. **Sin preselección** (D3): es dinero. Mientras no elija, se muestra la
 *    ayuda y el padre no dibuja ningún CTA.
 * 2. La opción seleccionada NO se distingue solo por color: cambia el borde, el
 *    fondo y se rellena el círculo interior (1.4.11 límites de control y
 *    1.4.1 uso del color). Contrastes MEDIDOS con los tokens reales sobre el
 *    fondo ya compuesto (`amber-100/60` sobre `amber-50/60`): círculo sin
 *    elegir `black/45` = 3.31:1 ✓; borde elegido `amber-600` = 2.97:1 ✗ (falta
 *    el 3:1), por eso el elegido usa `amber-700` = 4.69:1 ✓. En oscuro el
 *    elegido es `amber-400/70` sobre `amber-500/15` = 3.72:1 ✓.
 * 3. El `<input>` va `sr-only` (no `hidden`): `display:none` lo saca del árbol
 *    de accesibilidad; el anillo de foco se pinta en la tarjeta visible con
 *    `peer-focus-visible:`.
 * 4. Objetivo táctil: la tarjeta completa (`min-h-14`), no el círculo de 20 px.
 * 5. **`allowsOnDelivery = false` deshabilita CON motivo visible** (D7): la
 *    opción no se oculta — ocultar sin explicar parece un bug —, se muestra
 *    inactiva con "Este repartidor solo acepta pago por adelantado".
 */
export function PaymentMethodChoice({
  timing,
  onTimingChange,
  disabled = false,
  allowsOnDelivery = true,
  amount,
}: {
  /** Cuándo pagará (null mientras no elija). */
  timing: PaymentTiming | null
  onTimingChange: (timing: PaymentTiming) => void
  disabled?: boolean
  /** Snapshot D7 de la oferta: ¿el repartidor acepta cobrar al recibir? */
  allowsOnDelivery?: boolean
  /** Monto a pagar al repartidor (comida + envío, ya formateado): el número
   *  que decide la elección va DENTRO de cada opción, no repetido aparte. */
  amount: string
}) {
  return (
    <fieldset disabled={disabled} className="min-w-0">
      <legend className="text-sm font-medium">¿Cómo quieres pagar?</legend>
      <div className="mt-3 space-y-2">
        {(['UPFRONT', 'ON_DELIVERY'] as const).map((t) => {
          const selected = timing === t
          const optionDisabled = t === 'ON_DELIVERY' && !allowsOnDelivery
          return (
            <label key={t} className="block cursor-pointer">
              <input
                type="radio"
                name="payment-timing"
                value={t}
                checked={selected}
                disabled={optionDisabled}
                onChange={() => onTimingChange(t)}
                className="peer sr-only"
              />
              <span
                className={cn(
                  'flex min-h-14 items-start gap-3 rounded-2xl border p-3 transition-colors',
                  'border-black/10 bg-white dark:border-white/10 dark:bg-white/5',
                  'peer-checked:border-amber-700 peer-checked:bg-amber-100/60',
                  'dark:peer-checked:border-amber-400/70 dark:peer-checked:bg-amber-500/15',
                  'peer-focus-visible:outline peer-focus-visible:outline-2',
                  'peer-focus-visible:outline-offset-2 peer-focus-visible:outline-lime',
                  // Halo medido (ver `focus-halo` en globals.css): el lima solo mide
                  // 1.15:1 sobre blanco; el halo le da el 3:1 que falta.
                  'peer-focus-visible:focus-halo',
                  'peer-disabled:cursor-default peer-disabled:opacity-70'
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2',
                    selected
                      ? 'border-amber-700 dark:border-amber-400'
                      : 'border-black/45 dark:border-white/45'
                  )}
                >
                  <span
                    className={cn(
                      'h-2.5 w-2.5 rounded-full',
                      selected ? 'bg-amber-700 dark:bg-amber-400' : 'bg-transparent'
                    )}
                  />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium">
                    {PAYMENT_TIMING_COPY[t].title}
                  </span>
                  <span className="mt-0.5 block text-xs text-amber-900 dark:text-amber-100">
                    {optionDisabled
                      ? 'Este repartidor solo acepta pago por adelantado'
                      : PAYMENT_TIMING_COPY[t].subtitle(amount)}
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
