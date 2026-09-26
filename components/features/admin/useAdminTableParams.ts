'use client'

import { useCallback } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'

/**
 * Acceso tipado a los parámetros de tabla admin que viven en el
 * QUERYSTRING (compartible/bookmarkeable). Los componentes cliente
 * (AdminTableShell, tablas) lo usan para leer y actualizar la URL sin
 * duplicar lógica de querystring en cada tabla.
 */
export function useAdminTableParams() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  /** Valor actual de un parámetro ('' si no está). */
  const get = useCallback(
    (key: string): string => searchParams.get(key) ?? '',
    [searchParams]
  )

  /**
   * Reemplaza la URL actual con los pares dados. Los valores '' o null
   * QUITAN el parámetro de la URL. `resetPage` (default true) borra
   * ?page= porque un cambio de filtro/orden redefine el universo de
   * filas y la página actual puede quedarse fuera de rango.
   */
  const set = useCallback(
    (
      changes: Record<string, string | null>,
      options?: { resetPage?: boolean }
    ) => {
      const params = new URLSearchParams(searchParams.toString())
      for (const [key, value] of Object.entries(changes)) {
        if (value === null || value === '') params.delete(key)
        else params.set(key, value)
      }
      if (options?.resetPage !== false) params.delete('page')
      const qs = params.toString()
      router.replace(qs ? `${pathname}?${qs}` : pathname)
    },
    [searchParams, pathname, router]
  )

  return { get, set }
}
