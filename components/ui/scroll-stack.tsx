'use client'

import {
  Children,
  isValidElement,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from 'react'
import { cn } from '@/lib/utils'

interface ScrollStackProps {
  children: ReactNode
  className?: string
  itemClassName?: string
  itemDistance?: number
  stackOffset?: number
  topOffset?: number
  scaleStep?: number
  rotateStep?: number
}

export function ScrollStack({
  children,
  className,
  itemClassName,
  itemDistance = 140,
  stackOffset = 22,
  topOffset = 96,
  scaleStep = 0.06,
  rotateStep = 3,
}: ScrollStackProps) {
  const items = useMemo(
    () => Children.toArray(children).filter(isValidElement),
    [children]
  )
  const containerRef = useRef<HTMLDivElement>(null)
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const wrappers = Array.from(
      container.querySelectorAll<HTMLDivElement>('[data-scroll-stack-item]')
    )
    if (wrappers.length === 0) return

    const reduceMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches

    function update() {
      rafRef.current = null

      wrappers.forEach((el, i) => {
        const pinTop = topOffset + i * stackOffset
        el.style.top = `${pinTop}px`
        el.style.zIndex = `${i + 1}`

        if (reduceMotion) return

        const next = wrappers[i + 1]
        let progress = 0
        if (next) {
          const nextPinTop = topOffset + (i + 1) * stackOffset
          const nextTop = next.getBoundingClientRect().top
          progress =
            1 - Math.min(Math.max((nextTop - nextPinTop) / itemDistance, 0), 1)
        }

        const scale = 1 - progress * scaleStep
        const rotate = -progress * rotateStep
        const opacity = 1 - progress * 0.08

        el.style.transform = `scale(${scale}) rotate(${rotate}deg)`
        el.style.opacity = `${opacity}`
      })
    }

    function onScroll() {
      if (rafRef.current == null) {
        rafRef.current = requestAnimationFrame(update)
      }
    }

    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [items.length, itemDistance, stackOffset, topOffset, scaleStep, rotateStep])

  return (
    <div
      ref={containerRef}
      className={cn('relative', className)}
      style={{ paddingBottom: '50vh' }}
    >
      {items.map((child, i) => (
        <div
          key={(child as { key?: string | number | null }).key ?? i}
          data-scroll-stack-item
          className={cn('sticky will-change-transform', itemClassName)}
          style={{
            marginBottom: i < items.length - 1 ? itemDistance : 0,
          }}
        >
          {child}
        </div>
      ))}
    </div>
  )
}