'use client'

import { cn } from '@/lib/utils'
import {
  ON_DELIVERY_METHOD_COPY,
  PAYMENT_TIMING_COPY,
  type PaymentMethod,
  type PaymentTiming,
} from '@/lib/constants/payment-method'

/**
 * Elección de pago del cliente en DOS niveles (D2 del plan "Pagar al recibir"):
 *
 *   1. ¿Cuándo quieres pagar?  → Pagar ahora | Pagar al recibir
 *   2. (solo "al recibir") ¿Con qué pagarás? → Efectivo | Yape
 *
 * El sub-grupo vive DENTRO de la tarjeta "Pagar al recibir" y se monta solo
 * cuando esa opción está elegida (revelado progresivo; el montaje condicional
 * evita foco en controles invisibles). Componente CONTROLADO y sin estado
 * propio: el padre es dueño de `timing` y `method`, así que la elección y sus
 * consecuencias (qué CTA aparece) no pueden desincronizarse.
 *
 * Por qué radios NATIVOS (`<input type="radio">`): las flechas del teclado, la
 * agrupación por `name`, el anuncio "opción 1 de 2" y el foco por grupo son
 * comportamiento del NAVEGADOR; un div con role="radio" obligaría a
 * reimplementarlos. Fieldset/legend en cada nivel: agrupación y contexto para
 * lectores de pantalla.
 *
 * Decisiones que no son cosméticas:
 *
 * 1. **Sin preselección en NINGÚN nivel** (D3): es dinero. Mientras la tupla
 *    esté incompleta, se muestra la ayuda y el padre no dibuja ningún CTA.
 * 2. La opción seleccionada NO se distingue solo por color: cambia el borde, el
 *    fondo y se rellena el círculo interior (1.4.11 límites de control y
 *    1.4.1 uso del color, con contrastes medidos en el ciclo anterior: borde
 *    elegido `amber-600` = 3.19:1, círculo `black/45`/`white/45` ≥ 3.35:1).
 * 3. El `<input>` va `sr-only` (no `hidden`): `display:none` lo saca del árbol
 *    de accesibilidad; el anillo de foco se pinta en la tarjeta visible con
 *    `peer-focus-visible:`.
 * 4. Objetivo táctil: la tarjeta completa (`min-h-14` en el nivel 1, `min-h-12`
 *    en el 2), no el círculo de 20 px.
 * 5. **`allowsOnDelivery = false` deshabilita CON motivo visible** (D7): la
 *    opción no se oculta — ocultar sin explicar parece un bug —, se muestra
 *    inactiva con "Este repartidor solo acepta pago por adelantado". El
 *    fieldset deshabilitado saca el sub-grupo del orden de tabulación entero.
 */
export function PaymentMethodChoice({
  timing,
  method,
  onTimingChange,
  onMethodChange,
  disabled = false,
  allowsOnDelivery = true,
}: {
  /** Nivel 1: cuándo pagará (null mientras no elija). */
  timing: PaymentTiming | null
  /** Nivel 2: con qué pagará al recibir (null mientras no elija). */
  method: PaymentMethod | null
  onTimingChange: (timing: PaymentTiming) => void
  onMethodChange: (method: PaymentMethod) => void
  disabled?: boolean
  /** Snapshot D7 de la oferta: ¿el repartidor acepta cobrar al recibir? */
  allowsOnDelivery?: boolean
}) {
  return (
    <fieldset disabled={disabled} className="min-w-0">
      <legend className="text-sm font-medium">¿Cómo quieres pagar?</legend>
      <div className="mt-3 space-y-2">
        {(['UPFRONT', 'ON_DELIVERY'] as const).map((t) => {
          const selected = timing === t
          const optionDisabled = t === 'ON_DELIVERY' && !allowsOnDelivery
          return (
            // La etiqueta envuelve TAMBIÉN el sub-grupo: tocar cualquier parte
            // de la tarjeta "Pagar al recibir" la elige, como en cualquier
            // tarjeta de opción nativa.
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
                  'peer-checked:border-amber-600 peer-checked:bg-amber-100/60',
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
                    {PAYMENT_TIMING_COPY[t].title}
                  </span>
                  <span className="mt-0.5 block text-xs text-amber-900 dark:text-amber-100">
                    {optionDisabled
                      ? 'Este repartidor solo acepta pago por adelantado'
                      : PAYMENT_TIMING_COPY[t].subtitle}
                  </span>

                  {/* Sub-grupo "¿Con qué pagarás?": SOLO dentro de la tarjeta
                      elegida y solo si el repartidor lo permite (D7). Montaje
                      condicional, no `display:none`: los controles invisibles
                      no deben recibir foco. Cambiar el "cuándo" lo desmonta, y
                      el padre limpia el método si dejó de ser válido. */}
                  {selected && t === 'ON_DELIVERY' && allowsOnDelivery && (
                    <fieldset className="mt-3 min-w-0">
                      <legend className="text-xs font-medium text-amber-900 dark:text-amber-100">
                        ¿Con qué pagarás?
                      </legend>
                      <div className="mt-2 space-y-2">
                        {(['CASH', 'YAPE'] as const).map((m) => {
                          const methodSelected = method === m
                          return (
                            <label key={m} className="block cursor-pointer">
                              <input
                                type="radio"
                                name="payment-on-delivery-method"
                                value={m}
                                checked={methodSelected}
                                onChange={() => onMethodChange(m)}
                                className="peer sr-only"
                              />
                              <span
                                className={cn(
                                  'flex min-h-12 items-start gap-3 rounded-2xl border p-3 transition-colors',
                                  'border-black/10 bg-white dark:border-white/10 dark:bg-white/5',
                                  'peer-checked:border-amber-600 peer-checked:bg-amber-100/60',
                                  'dark:peer-checked:border-amber-400/70 dark:peer-checked:bg-amber-500/15',
                                  'peer-focus-visible:outline peer-focus-visible:outline-2',
                                  'peer-focus-visible:outline-offset-2 peer-focus-visible:outline-lime',
                                  'peer-focus-visible:focus-halo',
                                  'peer-disabled:cursor-default peer-disabled:opacity-70'
                                )}
                              >
                                <span
                                  aria-hidden
                                  className={cn(
                                    'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2',
                                    methodSelected
                                      ? 'border-amber-600 dark:border-amber-400'
                                      : 'border-black/45 dark:border-white/45'
                                  )}
                                >
                                  <span
                                    className={cn(
                                      'h-2.5 w-2.5 rounded-full',
                                      methodSelected
                                        ? 'bg-amber-600 dark:bg-amber-400'
                                        : 'bg-transparent'
                                    )}
                                  />
                                </span>
                                <span className="min-w-0">
                                  <span className="block text-sm font-medium">
                                    {ON_DELIVERY_METHOD_COPY[m].title}
                                  </span>
                                  <span className="mt-0.5 block text-xs text-amber-900 dark:text-amber-100">
                                    {ON_DELIVERY_METHOD_COPY[m].subtitle}
                                  </span>
                                </span>
                              </span>
                            </label>
                          )
                        })}
                      </div>
                    </fieldset>
                  )}
                </span>
              </span>
            </label>
          )
        })}
      </div>

      {/* El copy de PAYMENT_METHOD_COPY.YAPE (qué implica pagar ahora) vive en el
          panel que aparece debajo al elegir "Pagar ahora": repetirlo acá sería
          duplicar el mismo texto dos veces en la misma pantalla. */}
    </fieldset>
  )
}
