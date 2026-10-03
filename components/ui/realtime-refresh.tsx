'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/db/client'

/**
 * Refresca los server components de la página cuando cambia una tabla
 * (Postgres Changes + debounce para no recargar en ráfagas). No trae
 * datos: solo `router.refresh()`, que re-ejecuta los server components,
 * que ya aplican RLS y los joins correctos.
 *
 * La tabla debe estar en la publicación `supabase_realtime` (hoy:
 * `orders`, `deliveries`, `restaurants` y `profiles` — migración
 * 20260926100300_realtime_admin_tables.sql).
 *
 * `filter` (opcional): expresión de filtro de Postgres Changes
 * (ej. "is_approved=eq.false"). Se aplica EN EL SERVIDOR de realtime
 * antes de emitir el evento — útil para no refrescar la lista de
 * pendientes cuando cambia una fila que no es alta nueva pendiente
 * (ej. el dueño togglea is_open, el admin edita un restaurante ya
 * aprobado): esos cambios no disparan refresh.
 *
 * `syncOnSubscribe` y `refreshOnFocus` cubren los dos huecos clásicos del
 * tiempo real (plan-realtime-oferta-telefono-y-voucher-yape.md, Fase 1.1).
 * Ambos son opt-in para no cambiar el comportamiento ya desplegado de admin
 * y restaurante, que sólo necesitan "refresca cuando llegue un evento":
 *
 * 1. **Carrera SSR → suscripción.** Entre que el servidor renderizó y el
 *    canal llegó a `SUBSCRIBED` puede pasar un evento que nadie escuchó (el
 *    caso exacto "el repartidor ofertó mientras cargaba la página"). Con
 *    `syncOnSubscribe` se refresca una vez al quedar suscrito — y también en
 *    cada re-suscripción tras una caída del WebSocket, porque el revés tiene
 *    el mismo agujero: mientras el canal estaba caído, los eventos se
 *    perdieron.
 * 2. **Pestaña en segundo plano / móvil dormido.** El WebSocket se cae y al
 *    volver el usuario ve datos viejos. Con `refreshOnFocus` se refresca al
 *    recuperar la visibilidad.
 *
 * Por eso una pantalla que espera algo de otra persona ("estoy mirando a ver
 * si llega la oferta") debe activar los dos: sin ellos, el componente sólo
 * garantiza "refresca si el evento llega y nadie se durmió en el medio".
 */
export function RealtimeRefresh({
  channelName,
  table,
  event = '*',
  filter,
  debounceMs = 1000,
  syncOnSubscribe = false,
  refreshOnFocus = false,
}: {
  channelName: string
  table: string
  event?: 'INSERT' | 'UPDATE' | 'DELETE' | '*'
  filter?: string
  debounceMs?: number
  /** Refresca al quedar suscrito (y en cada re-suscripción). Cierra la
   *  ventana entre el render del servidor y el `subscribe`. */
  syncOnSubscribe?: boolean
  /** Refresca al volver a la pestaña o recuperar la visibilidad. */
  refreshOnFocus?: boolean
}) {
  const router = useRouter()
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const supabase = createClient()

    // Un único punto de entrada al refresh para todas las señales (evento,
    // suscripción, foco): así una ráfaga —el UPDATE de `orders` y lo que
    // venga detrás— se agrupa en un solo `router.refresh()`.
    const schedule = () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => router.refresh(), debounceMs)
    }

    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', { event, schema: 'public', table, filter }, schedule)
      .subscribe((status) => {
        if (status === 'SUBSCRIBED' && syncOnSubscribe) schedule()
      })

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') schedule()
    }
    if (refreshOnFocus) {
      document.addEventListener('visibilitychange', onVisibilityChange)
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      if (refreshOnFocus) {
        document.removeEventListener('visibilitychange', onVisibilityChange)
      }
      supabase.removeChannel(channel)
    }
  }, [channelName, table, event, filter, debounceMs, syncOnSubscribe, refreshOnFocus, router])

  return null
}
