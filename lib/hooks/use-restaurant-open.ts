'use client'

import { useEffect, useState } from 'react'
import {
  isRestaurantOpenNow,
  type RestaurantHourInput,
} from '@/lib/restaurants/is-open'

export function useRestaurantOpen(
  isOpen: boolean,
  hours: RestaurantHourInput[]
): boolean {
  const [isOpenNow, setIsOpenNow] = useState(() =>
    isRestaurantOpenNow(isOpen, hours)
  )

  useEffect(() => {
    const evaluate = () => setIsOpenNow(isRestaurantOpenNow(isOpen, hours))
    evaluate()
    const timer = setInterval(evaluate, 60_000)
    return () => clearInterval(timer)
  }, [isOpen, hours])

  return isOpenNow
}