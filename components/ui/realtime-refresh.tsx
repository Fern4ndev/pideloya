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
 * `orders` y `deliveries`).
 */
export function RealtimeRefresh({
  channelName,
  table,
  event = '*',
  debounceMs = 1000,
}: {
  channelName: string
  table: string
  event?: 'INSERT' | 'UPDATE' | 'DELETE' | '*'
  debounceMs?: number
}) {
  const router = useRouter()
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', { event, schema: 'public', table }, () => {
        if (timerRef.current) clearTimeout(timerRef.current)
        timerRef.current = setTimeout(() => router.refresh(), debounceMs)
      })
      .subscribe()

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      supabase.removeChannel(channel)
    }
  }, [channelName, table, event, debounceMs, router])

  return null
}
