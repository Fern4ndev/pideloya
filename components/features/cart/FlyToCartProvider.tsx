'use client'

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { AnimatePresence, LazyMotion, domAnimation, m } from 'motion/react'

export interface FlyRequest {
  /** Rect del origen (foto del producto) medido en el mismo frame del clic. */
  sourceRect: DOMRect
  /** URL de la imagen para la partícula; si es null se vuela un punto de marca. */
  imageUrl: string | null
  /** Nombre del producto (a11y del overlay). */
  productName: string
}

interface Flight extends FlyRequest {
  id: number
  targetRect: DOMRect
}

type FlyFn = (req: FlyRequest) => void

const FlyToCartContext = createContext<FlyFn>(() => {})

export function useFlyToCart(): FlyFn {
  return useContext(FlyToCartContext)
}

/**
 * Elige el destino del vuelo según viewport:
 * - desktop (>=1024): icono del header (siempre visible, patrón estándar).
 * - móvil (<768): dock inferior del CartBar (zona de pulgar, CTA real).
 * - tablet: el más cercano al origen.
 */
function resolveTarget(sourceRect: DOMRect): DOMRect | null {
  if (typeof document === 'undefined') return null
  const header = document.querySelector('[data-cart-target="header"]')
  const dock = document.querySelector('[data-cart-target="bar-dock"]')
  const headerRect = header?.getBoundingClientRect() ?? null
  // El dock es un placeholder invisible siempre montado: mide el rect final
  // del CartBar incluso cuando el pill está oculto (primer producto).
  const dockRect = dock?.getBoundingClientRect() ?? null

  const width = window.innerWidth
  if (width >= 1024) return headerRect
  if (width < 768) return dockRect ?? headerRect

  // Tablet: destino más cercano al origen.
  if (headerRect && dockRect) {
    const sx = sourceRect.left + sourceRect.width / 2
    const sy = sourceRect.top + sourceRect.height / 2
    const dist = (r: DOMRect) =>
      Math.hypot(r.left + r.width / 2 - sx, r.top + r.height / 2 - sy)
    return dist(dockRect) <= dist(headerRect) ? dockRect : headerRect
  }
  return dockRect ?? headerRect
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

const MAX_CONCURRENT_FLIGHTS = 3
const FLIGHT_DURATION = 0.55
/** Curva del panel de cliente (globals.css `--ease-client`). */
const EASE_CLIENT: [number, number, number, number] = [0.16, 1, 0.3, 1]

function FlightParticle({
  flight,
  onDone,
}: {
  flight: Flight
  onDone: (id: number) => void
}) {
  const { sourceRect, targetRect, imageUrl, productName } = flight

  const dx =
    targetRect.left +
    targetRect.width / 2 -
    (sourceRect.left + sourceRect.width / 2)
  const dy =
    targetRect.top +
    targetRect.height / 2 -
    (sourceRect.top + sourceRect.height / 2)
  // La partícula aterriza del tamaño del destino (badge ~20px / pill ~56px).
  const endScale = Math.min(
    0.3,
    Math.max(0.12, targetRect.width / Math.max(1, sourceRect.width))
  )
  const size = Math.max(40, Math.min(96, sourceRect.width))
  const startX = sourceRect.left + sourceRect.width / 2 - size / 2
  const startY = sourceRect.top + sourceRect.height / 2 - size / 2

  return (
    <m.div
      initial={{ x: 0, y: 0, scale: 1, opacity: 1 }}
      animate={{ x: dx, y: [0, dy * 0.55, dy], scale: endScale, opacity: 0.45 }}
      transition={{ duration: FLIGHT_DURATION, ease: EASE_CLIENT }}
      onAnimationComplete={() => onDone(flight.id)}
      aria-hidden
      className="fixed left-0 top-0 z-[60] overflow-hidden rounded-2xl shadow-client-floating"
      style={{ left: startX, top: startY, width: size, height: size }}
    >
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl}
          alt=""
          className="h-full w-full object-cover"
          draggable={false}
        />
      ) : (
        <span
          aria-hidden
          className="flex h-full w-full items-center justify-center bg-gradient-to-br from-brand-500 to-brand-600 text-lg font-bold text-white"
        >
          {productName.charAt(0) ?? '+'}
        </span>
      )}
    </m.div>
  )
}

export function FlyToCartProvider({ children }: { children: ReactNode }) {
  const [flights, setFlights] = useState<Flight[]>([])
  const idRef = useRef(0)

  const removeFlight = useCallback((id: number) => {
    setFlights((prev) => prev.filter((f) => f.id !== id))
  }, [])

  const fly = useCallback<FlyFn>(
    (req) => {
      if (prefersReducedMotion()) return
      const targetRect = resolveTarget(req.sourceRect)
      // Sin destino medible (fuera del panel /cliente) no hay vuelo: el
      // carrito igual ya se actualizó, solo se pierde el efecto.
      if (!targetRect || targetRect.width === 0) return
      idRef.current += 1
      const flight: Flight = { ...req, id: idRef.current, targetRect }
      setFlights((prev) =>
        prev.length >= MAX_CONCURRENT_FLIGHTS
          ? [...prev.slice(1), flight]
          : [...prev, flight]
      )
      // Red de seguridad: si onAnimationComplete no dispara (pestaña
      // oculta, desmontaje), la partícula no queda colgada.
      window.setTimeout(() => removeFlight(flight.id), 1200)
    },
    [removeFlight]
  )

  const contextValue = useMemo(() => fly, [fly])

  return (
    <LazyMotion features={domAnimation} strict>
      <FlyToCartContext.Provider value={contextValue}>
        {children}
        <div aria-hidden className="pointer-events-none fixed inset-0 z-[60]">
          <AnimatePresence>
            {flights.map((flight) => (
              <FlightParticle
                key={flight.id}
                flight={flight}
                onDone={removeFlight}
              />
            ))}
          </AnimatePresence>
        </div>
      </FlyToCartContext.Provider>
    </LazyMotion>
  )
}
