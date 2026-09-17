'use client'

import { useState, useEffect, useCallback } from 'react'
import { Icon } from '@iconify-icon/react'
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from '@/components/ui/carousel'

const STEPS = [
  {
    step: 1,
    label: 'PASO 01',
    title: 'Haz tu pedido',
    description:
      'Explora los mejores restaurantes de Abancay, elige lo que necesitas y confirma en un solo clic.',
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth="1.7"
        stroke="currentColor"
        className="h-7 w-7"
      >
        <rect width="14" height="18" x="5" y="3" rx="2" />
        <path d="M9 18h6" />
      </svg>
    ),
    progress: 100,
    progressLabel: 'Pedido creado',
    progressIcon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className="h-4 w-4"
      >
        <path d="m12 3 9 5-9 5-9-5 9-5Z" />
        <path d="m3 12 9 5 9-5" />
        <path d="m3 16 9 5 9-5" />
      </svg>
    ),
  },
  {
    step: 2,
    label: 'PASO 02',
    title: 'Sale hacia ti',
    description:
      'Un repartidor local recoge tu pedido y se dirige a tu ubicación con seguimiento en vivo.',
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth="1.7"
        stroke="currentColor"
        className="h-7 w-7"
      >
        <path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2" />
        <path d="M15 18H9" />
        <path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14" />
        <circle cx="17" cy="18" r="2" />
        <circle cx="7" cy="18" r="2" />
      </svg>
    ),
    progress: 60,
    progressLabel: 'En camino',
    progressIcon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className="h-4 w-4"
      >
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    ),
  },
  {
    step: 3,
    label: 'PASO 03',
    title: 'Recíbelo en casa',
    description:
      'Tu pedido llega a la puerta de tu casa en minutos. ¡Disfrútalo!',
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth="1.7"
        stroke="currentColor"
        className="h-7 w-7"
      >
        <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
    progress: 0,
    progressLabel: 'Entregado',
    progressIcon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className="h-4 w-4"
      >
        <path d="M20 6 9 17l-5-5" />
      </svg>
    ),
  },
]

export function HowItWorks() {
  const [api, setApi] = useState<CarouselApi>()
  const [current, setCurrent] = useState(0)

  const onSelect = useCallback((api: CarouselApi) => {
    if (!api) return
    setCurrent(api.selectedScrollSnap())
  }, [])

  useEffect(() => {
    if (!api) return
    onSelect(api)
    api.on('select', onSelect)
    return () => {
      api.off('select', onSelect)
    }
  }, [api, onSelect])

  useEffect(() => {
    if (!api) return
    const interval = setInterval(() => {
      if (api.canScrollNext()) {
        api.scrollNext()
      } else {
        api.scrollTo(0)
      }
    }, 4000)
    return () => clearInterval(interval)
  }, [api])

  return (
    <section id="como-funciona" className="relative py-24 px-6" style={{ background: 'radial-gradient(ellipse 80% 50% at 50% 50%, transparent 0%, rgba(139, 123, 255, 0.25) 100%)' }}>
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <span className="inline-block text-sm font-semibold text-brand-600 tracking-wide uppercase mb-4">
            Cómo funciona
          </span>
          <h2 className="text-3xl md:text-5xl text-white font-bold tracking-tight">
            Tan fácil como 1, 2, 3
          </h2>
          <p className="mt-4 text-lg text-muted-foreground max-w-xl mx-auto">
            Ordena en segundos y recibe tu pedido en minutos.
          </p>
        </div>

        <Carousel
          setApi={setApi}
          opts={{ align: 'start', loop: true }}
          className="w-full max-w-5xl mx-auto cursor-grab active:cursor-grabbing"
        >
          <CarouselContent className="-ml-4 overflow-hidden select-none">
            {STEPS.map((step) => (
              <CarouselItem
                key={step.step}
                className="pl-4 md:basis-1/3"
              >
                <article className="group relative overflow-hidden rounded-[28px] border border-zinc-800/80 bg-zinc-950/80 p-6 shadow-glow backdrop-blur-xl transition duration-500 hover:-translate-y-1 hover:border-yellow-400/30 hover:bg-zinc-900/80 h-full">
                  <div className="absolute right-0 top-0 h-32 w-32 rounded-full bg-yellow-400/[0.04] blur-3xl transition duration-500 group-hover:bg-yellow-400/[0.09]" />

                  <div className="relative">
                    <div className="mb-7 flex items-center justify-between">
                      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-yellow-400 text-sm font-bold text-black">
                        {step.step}
                      </span>
                      <span className="text-xs font-medium uppercase tracking-widest text-zinc-600">
                        {step.label}
                      </span>
                    </div>

                    <div className="mb-7 flex h-14 w-14 items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-900 text-yellow-400 transition duration-500 group-hover:border-yellow-400/30 group-hover:shadow-glowStrong">
                      {step.icon}
                    </div>

                    <h2 className="text-xl font-semibold tracking-tight text-white">
                      {step.title}
                    </h2>

                    <p className="mt-3 min-h-[84px] text-sm leading-6 text-zinc-400">
                      {step.description}
                    </p>

                    <div className="mt-7 rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4">
                      <div className="mb-3 flex items-center gap-2">
                        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-yellow-400 text-black">
                          {step.progressIcon}
                        </div>
                        <span className="text-xs font-medium text-zinc-300">
                          {step.progressLabel}
                        </span>
                      </div>

                      <div className="h-1.5 overflow-hidden rounded-full bg-zinc-800">
                        <div
                          className="h-full rounded-full bg-yellow-400 transition-all duration-700"
                          style={{ width: `${step.progress}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </article>
              </CarouselItem>
            ))}
          </CarouselContent>
        </Carousel>

        <div className="flex justify-center gap-2 mt-8">
          {STEPS.map((_, index) => (
            <button
              key={index}
              onClick={() => api?.scrollTo(index)}
              className={`h-2 rounded-full transition-all duration-300 ${
                current === index
                  ? 'w-8 bg-yellow-400'
                  : 'w-2 bg-zinc-700 hover:bg-zinc-600'
              }`}
              aria-label={`Go to slide ${index + 1}`}
              suppressHydrationWarning
            />
          ))}
        </div>
      </div>
    </section>
  )
}
