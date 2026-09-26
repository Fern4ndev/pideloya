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
 */
export function RealtimeRefresh({
  channelName,
  table,
  event = '*',
  filter,
  debounceMs = 1000,
}: {
  channelName: string
  table: string
  event?: 'INSERT' | 'UPDATE' | 'DELETE' | '*'
  filter?: string
  debounceMs?: number
}) {
  const router = useRouter()
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event, schema: 'public', table, filter },
        () => {
          if (timerRef.current) clearTimeout(timerRef.current)
          timerRef.current = setTimeout(() => router.refresh(), debounceMs)
        }
      )
      .subscribe()

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      supabase.removeChannel(channel)
    }
  }, [channelName, table, event, filter, debounceMs, router])

  return null
}
