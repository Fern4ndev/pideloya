// lib/hooks/use-realtime-invalidate.ts
'use client'

import { useEffect, useRef } from 'react'
import { createClient } from '@/lib/db/client'

interface RealtimeInvalidateOptions {
  channelName: string
  table: string
  event?: 'INSERT' | 'UPDATE' | 'DELETE' | '*'
  filter?: string // ej. "id=eq.<uuid>"
  /** Agrupa ráfagas de eventos (el UPDATE de orders + los que vengan detrás)
   *  en UN solo onChange. 2000 ms por defecto: los eventos de un mismo cambio
   *  llegan juntos; quien espera una respuesta en vivo (detalle del pedido)
   *  puede bajarlo explícitamente. */
  debounceMs?: number
}

/**
 * No trae datos por sí mismo: solo escucha cambios en la tabla vía
 * Postgres Changes y dispara `onChange` (normalmente el `mutate` de
 * SWR) para que la vista se revalide desde la API, que ya aplica RLS
 * y hace los joins correctos.
 *
 * v2 (Fase 2 del plan de optimización): debounce nativo + callback en un ref.
 * Antes cada evento disparaba `onChange` INMEDIATAMENTE — una ráfaga (un
 * pedido que avanza escribe orders + deliveries) mutaba N veces, y una
 * función inline nueva en cada render (`() => mutate()`) resuscribía el
 * canal entero por render si cambiaban las dependencias del efecto.
 */
export function useRealtimeInvalidate(
  { channelName, table, event = '*', filter, debounceMs = 2000 }: RealtimeInvalidateOptions,
  onChange: () => void
) {
  // El callback vive en un ref: el effect NO depende de él, así que un
  // callback nuevo (nuevo render) no desmonta ni resuscribe el canal.
  const onChangeRef = useRef(onChange)
  useEffect(() => {
    onChangeRef.current = onChange
  })

  useEffect(() => {
    const supabase = createClient()
    let timer: ReturnType<typeof setTimeout> | null = null

    const schedule = () => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => onChangeRef.current(), debounceMs)
    }

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event, schema: 'public', table, filter },
        schedule
      )
      .subscribe()

    return () => {
      if (timer) clearTimeout(timer)
      supabase.removeChannel(channel)
    }
  }, [channelName, table, event, filter, debounceMs])
}