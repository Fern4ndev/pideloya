'use client'

import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

export interface MenuCategoryNavItem {
  id: string
  name: string
  count: number
}

/**
 * Pills de categorías con scroll-spy para la carta del restaurante.
 *
 * Barra sticky bajo el header del panel (61px) con scroll horizontal en
 * móvil; cada pill ancla a su sección (`#cat-{id}`). La sección activa se
 * detecta con `IntersectionObserver` y se marca con `aria-current`.
 * Con una sola sección no aporta navegación y el padre no la renderiza.
 */
export function MenuCategoryNav({ items }: { items: MenuCategoryNavItem[] }) {
  const [activeId, setActiveId] = useState(items[0]?.id ?? '')

  useEffect(() => {
    const sections = items
      .map((item) => document.getElementById(`cat-${item.id}`))
      .filter((el): el is HTMLElement => el !== null)
    if (sections.length === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id.replace(/^cat-/, ''))
          }
        }
      },
      // La sección que ocupa la franja central del viewport manda: evita
      // parpadeos al cruzar bordes entre secciones contiguas.
      { rootMargin: '-40% 0px -55% 0px' }
    )
    sections.forEach((section) => observer.observe(section))
    return () => observer.disconnect()
  }, [items])

  return (
    <nav
      aria-label="Categorías de la carta"
      className="sticky top-[61px] z-20 -mx-4 border-b border-black/5 bg-white/80 px-4 py-2.5 backdrop-blur-xl dark:border-white/10 dark:bg-neutral-950/80"
    >
      <div className="flex gap-1.5 overflow-x-auto">
        {items.map((item) => {
          const active = item.id === activeId
          return (
            <a
              key={item.id}
              href={`#cat-${item.id}`}
              aria-current={active ? 'true' : undefined}
              className={cn(
                'flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition-all duration-150',
                active
                  ? 'bg-gradient-to-r from-brand-500 to-brand-600 text-white shadow-client-card'
                  : 'bg-black/[0.03] text-muted-foreground hover:bg-black/5 hover:text-foreground dark:bg-white/5 dark:hover:bg-white/10'
              )}
            >
              {item.name}
              <span
                className={cn(
                  'rounded-full px-1.5 text-[11px] font-bold tabular-nums',
                  active ? 'bg-white/20 text-white' : 'bg-black/5 text-muted-foreground dark:bg-white/10'
                )}
              >
                {item.count}
              </span>
            </a>
          )
        })}
      </div>
    </nav>
  )
}
