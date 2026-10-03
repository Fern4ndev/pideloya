'use client'

import { useEffect, useRef } from 'react'

/**
 * Video del hero (Fase 4): el navegador ya NO lo descarga entero al abrir la
 * landing (preload="metadata" = solo la cabecera/primera escena) y NO se
 * reproduce si el usuario pidió `prefers-reduced-motion: reduce` — el
 * atributo autoPlay ignora esa preferencia, así que el play se decide aquí.
 *
 * No hay `poster`: no existe un asset de poster en /public/videos y el primer
 * fotograma que trae preload="metadata" cumple la misma función (ver docs:
 * pendiente generar landing-poster.jpg si se quiere un póster real).
 */
export function LandingVideo() {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (prefersReduced.matches) return

    // Save-Data: si el usuario pidió ahorrar datos móviles, no autoplay;
    // el video queda listo para que él lo reproduzca.
    const connection = (
      navigator as Navigator & { connection?: { saveData?: boolean } }
    ).connection
    if (connection?.saveData) return

    // Autoplay necesita muted (ya está) y puede prometer fallar si el
    // navegador decide lo contrario: nunca debe lanzar uncaught.
    void video.play().catch(() => {})
  }, [])

  return (
    <video
      ref={videoRef}
      loop
      muted
      playsInline
      preload="metadata"
      className="h-full w-full object-contain pointer-events-none"
      src="/videos/landing.mp4"
    />
  )
}
