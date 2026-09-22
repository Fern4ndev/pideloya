// lib/hooks/use-realtime-invalidate.ts
'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/db/client'

interface RealtimeInvalidateOptions {
  channelName: string
  table: string
  event?: 'INSERT' | 'UPDATE' | 'DELETE' | '*'
  filter?: string // ej. "id=eq.<uuid>"
}

/**
 * No trae datos por sí mismo: solo escucha cambios en la tabla vía
 * Postgres Changes y dispara `onChange` (normalmente el `mutate` de
 * SWR) para que la vista se revalide desde la API, que ya aplica RLS
 * y hace los joins correctos.
 */
export function useRealtimeInvalidate(
  { channelName, table, event = '*', filter }: RealtimeInvalidateOptions,
  onChange: () => void
) {
  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event, schema: 'public', table, filter },
        () => onChange()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelName, table, event, filter])
}