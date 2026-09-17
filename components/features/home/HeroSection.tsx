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

      {/* Anillos decorativos giratorios */}
      <div className="pointer-events-none absolute right-[-6%] top-[8%] z-0 h-[560px] w-[560px] rounded-full border border-dashed border-lime/35 opacity-100 [animation:spin_40s_linear_infinite] max-md:opacity-50" />
      <div className="pointer-events-none absolute right-[-16%] top-[-4%] z-0 h-[760px] w-[760px] rounded-full border border-dashed border-lime/35 opacity-100 [animation:spin-reverse_70s_linear_infinite] max-md:opacity-50" />

      {/* Contenido principal */}
      <div className="relative z-10 mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid items-center gap-8 py-[140px] max-lg:grid-cols-1 max-lg:py-[120px] lg:grid-cols-[1.1fr_0.9fr] lg:gap-12">
          {/* Columna izquierda — Texto */}
          <div className="relative z-10">
            {/* Badge */}
            <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-lime/40 bg-transparent px-4 py-2 text-xs font-medium text-lime">
              <span className="h-2 w-2 rounded-full bg-lime [animation:pulse_1.6s_infinite]" />
              Entregando ahora en tu ciudad
            </div>

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

          {/* Columna derecha — Ilustraciones */}
          <div className="relative h-[400px] sm:h-[480px] lg:h-[560px]">
            {/* Food card 1 — Burger */}
            <div className="absolute left-[4%] top-[6%] rounded-3xl border border-white/[0.09] bg-panel p-4 shadow-[0_30px_60px_rgba(0,0,0,0.5)] [animation:float_6s_ease-in-out_0.2s_infinite] [transform:rotate(-6deg)]">
              <div className="flex h-[150px] w-[150px] items-center justify-center rounded-full bg-[#232326] max-sm:h-[120px] max-sm:w-[120px]">
                <div className="flex flex-col items-center gap-1">
                  <div className="h-[30px] w-[80px] rounded-[50px_50px_12px_12px] bg-[#c98a3d]" />
                  <div className="h-2 w-[86px] rounded-[3px] bg-coral" />
                  <div className="h-3 w-[78px] rounded-[5px] bg-[#40251a]" />
                  <div className="h-2 w-[86px] rounded-[3px] bg-coral" />
                  <div className="h-5 w-[80px] rounded-[20px] bg-[#c98a3d]" />
                </div>
              </div>
            </div>

            {/* Food card 2 — Box */}
            <div className="absolute right-0 top-[38%] rounded-3xl border border-white/[0.09] bg-panel p-4 shadow-[0_30px_60px_rgba(0,0,0,0.5)] [animation:float_6s_ease-in-out_infinite] [transform:rotate(5deg)]">
              <div className="relative flex h-[150px] w-[150px] items-center justify-center rounded-[10px] bg-[#232326] max-sm:h-[120px] max-sm:w-[120px]">
                <div className="h-[55px] w-[55px] rounded-full bg-[#ffd23e]" />
                <div className="absolute bottom-2 right-2 h-[42px] w-[42px] rounded-full bg-[#ff8c42]" />
              </div>
            </div>

            {/* Food card 3 — Drink */}
            <div className="absolute bottom-[4%] left-[14%] rounded-3xl border border-white/[0.09] bg-panel p-4 shadow-[0_30px_60px_rgba(0,0,0,0.5)] [animation:float_6s_ease-in-out_1s_infinite] [transform:rotate(-3deg)]">
              <div className="flex h-[150px] w-[150px] flex-col items-center justify-center max-sm:h-[120px] max-sm:w-[120px]">
                <div className="h-3.5 w-[80px] rounded-lg bg-lime" />
                <div className="flex h-[105px] w-[70px] items-center justify-center gap-2.5 rounded-b-[14px] bg-violet [transform:perspective(100px)_rotateX(-2deg)]">
                  <span className="h-[9px] w-[9px] rounded-full bg-white/70" />
                  <span className="h-[9px] w-[9px] rounded-full bg-white/70" />
                </div>
              </div>
            </div>

            {/* Tags flotantes */}
            <div className="absolute right-[18%] top-0 rotate-[4deg] rounded-full bg-coral px-4 py-2 text-xs font-bold text-white [animation:float_5s_ease-in-out_infinite]">
              🔥 20% off hoy
            </div>
            <div className="absolute bottom-[26%] right-[6%] -rotate-[4deg] rounded-full bg-lime px-4 py-2 text-xs font-bold text-panel [animation:float_5s_ease-in-out_0.6s_infinite]">
              ⚡ Llega en 8 min
            </div>
            <div className="absolute left-[-4%] top-[34%] rotate-[6deg] rounded-full bg-violet px-4 py-2 text-xs font-bold text-white [animation:float_5s_ease-in-out_1.2s_infinite]">
              🛵 Marco está en camino
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
