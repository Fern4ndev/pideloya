import { Icon } from '@iconify-icon/react'

const FLOATING_ITEMS = [
  { icon: 'twemoji:hamburger', className: 'absolute -top-10 left-10 text-5xl float-1 opacity-80', delay: '' },
  { icon: 'twemoji:pizza', className: 'absolute -top-5 right-16 text-4xl float-2 opacity-80', delay: '' },
  { icon: 'twemoji:taco', className: 'absolute top-20 -left-5 text-3xl float-3 opacity-70', delay: '' },
  { icon: 'twemoji:green-salad', className: 'absolute top-32 right-0 text-4xl float-1 opacity-70', delay: 'animation-delay: -2s' },
  { icon: 'twemoji:steaming-bowl', className: 'absolute bottom-40 left-20 text-3xl float-2 opacity-60', delay: 'animation-delay: -1s' },
  { icon: 'twemoji:hot-beverage', className: 'absolute bottom-20 right-24 text-4xl float-3 opacity-70', delay: 'animation-delay: -3s' },
]

const STATS = [
  { value: '50+', label: 'Restaurantes' },
  { value: '15min', label: 'Entrega promedio' },
  { value: 'Abancay', label: 'Ciudad' },
]

export function HeroSection() {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden hero-gradient pt-20">
      <div className="relative z-10 text-center px-6 max-w-4xl mx-auto">
        {FLOATING_ITEMS.map((item, i) => (
          <div
            key={i}
            className={`${item.className} select-none pointer-events-none`}
            style={item.delay ? { animationDelay: item.delay.split(': ')[1] } : undefined}
          >
            <Icon icon={item.icon} width="1em" height="1em" />
          </div>
        ))}

        <div className="glass rounded-3xl px-8 py-12 md:px-16 md:py-16">
          <div className="inline-flex items-center gap-2 bg-white/15 rounded-full px-4 py-1.5 mb-6">
            <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            <span className="text-sm font-medium text-white/90">Disponible en Abancay</span>
          </div>

          <h1 className="text-4xl md:text-6xl lg:text-7xl font-extrabold text-white tracking-tight leading-[1.1]">
            ¿Se te antoja algo?
            <span className="block mt-2">¡Pídelo YA!</span>
          </h1>

          <p className="mt-6 text-lg md:text-xl text-white/80 max-w-2xl mx-auto leading-relaxed">
            Pide de los mejores negocios de Abancay. Rápido, fácil y con repartidores
            locales que conocen cada esquina.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href="/login"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-white text-foreground font-semibold px-8 py-4 rounded-full text-base hover:bg-muted transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <Icon icon="lucide:search" width="20" height="20" />
              Explorar restaurantes
            </a>
            <a
              href="#unete"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 glass text-white font-semibold px-8 py-4 rounded-full text-base hover:bg-white/20 transition-all"
            >
              Soy negocio o repartidor
            </a>
          </div>
        </div>

        <div className="mt-12 grid grid-cols-3 gap-6 max-w-lg mx-auto">
          {STATS.map((stat) => (
            <div key={stat.label} className="text-center">
              <div className="text-2xl md:text-3xl font-bold text-white">{stat.value}</div>
              <div className="text-sm text-white/70 mt-1">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent" />
    </section>
  )
}
