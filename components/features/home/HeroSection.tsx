import { Icon } from '@iconify-icon/react'
import { ChevronRightIcon } from '@animateicons/react/huge'

export function HeroSection() {
  return (
    <section className="relative w-full overflow-hidden bg-transparent text-[#f5f2ea]">
      {/* Blobs decorativos */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-40 -right-[120px] z-0 h-[520px] w-[520px] rounded-full opacity-50 blur-[90px]"
        style={{ background: 'var(--coral)' }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-[-120px] top-[560px] z-0 h-[420px] w-[420px] rounded-full opacity-35 blur-[90px]"
        style={{ background: 'var(--violet)' }}
      />

      {/* Contenido principal */}
      <div className="relative z-10 mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid items-center gap-8 py-[140px] max-lg:grid-cols-1 max-lg:py-[120px] lg:grid-cols-[1.5fr_1.5fr] lg:gap-12 overflow-visible">
          {/* Columna izquierda — Texto */}
          <div className="relative z-20">
            {/* Título */}
            <h1 className="text-[clamp(2rem,6.4vw,5.75rem)] font-extrabold leading-[0.98] tracking-[-2px] text-[#f5f2ea]">
              Tu antojo
              <br />
              <span className="text-transparent [-webkit-text-stroke:2px_#f5f2ea]">no espera.</span>
              <br />
              <span className="text-lime">PideloYa.</span>
            </h1>

            {/* Descripción */}
            <p className="mx-left mt-7 max-w-md leading-relaxed text-[#9b978c] max-sm:text-sm md:text-base">
              Comida, mercado, farmacia y hasta lo que se te ocurra. Mensajeros
              locales, seguimiento en vivo y entrega promedio de 12 minutos.
            </p>

            {/* Barra de búsqueda */}
            <div className="mt-9 flex max-w-[480px] rounded-full border border-white/10 bg-panel p-2 transition-all duration-300 focus-within:border-lime focus-within:shadow-[0_0_0_4px_rgba(216,255,62,0.12)] max-sm:flex-col max-sm:rounded-[20px]">
              <div className="flex min-w-0 flex-1 items-center">
                <Icon
                  icon="mdi:map-marker-outline"
                  className="ml-3 shrink-0 text-xl text-[#9b978c]"
                />
                <input
                  type="text"
                  placeholder="¿Dónde te lo llevamos?"
                  className="min-w-0 flex-1 bg-transparent px-4 py-2.5 text-sm text-[#f5f2ea] outline-none placeholder:text-[#9b978c]"
                  suppressHydrationWarning
                />
              </div>
              <button type="button" className="button-coral max-sm:w-full" suppressHydrationWarning>
                <span>Pide ya</span>
                <ChevronRightIcon size={24} duration={1.5} color="#ffffff" />
              </button>
            </div>
          </div>

          {/* Columna derecha — Video */}
          <div className="relative z-10 h-auto w-[140%] -ml-[15%] object-contain [mask-image:linear-gradient(to_right,transparent_0%,black_25%,black_50%,transparent_100%),linear-gradient(to_bottom,transparent_0%,black_20%,black_80%,transparent_100%)] [mask-composite:intersect]">
            <video
              autoPlay
              loop
              muted
              playsInline
              className="h-full w-full object-contain"
              src="/videos/landing.mp4"
            />
          </div>
        </div>
      </div>
    </section>
  )
}
