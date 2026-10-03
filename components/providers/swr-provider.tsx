'use client'

import { SWRConfig } from 'swr'

/**
 * Defaults de SWR para TODA la app (Fase 2 del plan de optimización).
 *
 * - `revalidateOnFocus: false`: el foco de la pestaña ya no dispara consulta
 *   en ninguno de los hooks SWR del proyecto. El realtime (eventos de
 *   Postgres filtrados) es la señal de revalidación; el alt-tab no lo es.
 *   Cada hook puede re-activarlo explícitamente si algún día lo necesita.
 * - `dedupingInterval: 5000`: montajes simultáneos del mismo hook dentro de
 *   5 s comparten UNA consulta en vez de duplicarla.
 * - `errorRetryCount: 2`: un fallo puntual no martilla la API con reintentos
 *   infinitos (SWR por defecto reintenta con backoff indefinidamente).
 */
export function SwrProvider({ children }: { children: React.ReactNode }) {
  return (
    <SWRConfig
      value={{
        revalidateOnFocus: false,
        dedupingInterval: 5000,
        errorRetryCount: 2,
      }}
    >
      {children}
    </SWRConfig>
  )
}
