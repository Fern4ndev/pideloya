'use client'

import { useCallback } from 'react'
import { useFlyToCart } from '@/components/features/cart/FlyToCartProvider'

/**
 * Atajo para las tarjetas de producto: mide el elemento origen (foto) en el
 * mismo frame del clic y dispara el vuelo. No hace nada con
 * `prefers-reduced-motion` o sin elemento medible — el carrito igual ya se
 * actualizó en el store, solo se omite el efecto.
 */
export function useRequestFlyToCart() {
  const fly = useFlyToCart()

  return useCallback(
    (sourceEl: Element | null, opts: { imageUrl: string | null; productName: string }) => {
      if (!sourceEl) return
      const rect = sourceEl.getBoundingClientRect()
      if (rect.width === 0 && rect.height === 0) return
      fly({ sourceRect: rect, imageUrl: opts.imageUrl, productName: opts.productName })
    },
    [fly]
  )
}
