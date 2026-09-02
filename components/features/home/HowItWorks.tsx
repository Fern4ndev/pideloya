import { Icon } from '@iconify-icon/react'

const STEPS = [
  {
    step: 'PASO 1',
    title: 'Explora',
    description: 'Descubre los mejores restaurantes de Abancay y encuentra lo que se te antoja.',
    icon: 'lucide:search',
    gradient: 'from-brand-400 to-brand-500',
    shadow: 'shadow-brand-500/25',
  },
  {
    step: 'PASO 2',
    title: 'Pide',
    description: 'Elige tus platos, personaliza tu pedido y confirma en un solo clic.',
    icon: 'lucide:shopping-cart',
    gradient: 'from-brand-500 to-red-500',
    shadow: 'shadow-red-500/25',
  },
  {
    step: 'PASO 3',
    title: 'Recibe',
    description: 'Un repartidor local lleva tu pedido hasta la puerta de tu casa.',
    icon: 'lucide:zap',
    gradient: 'from-emerald-400 to-teal-500',
    shadow: 'shadow-emerald-500/25',
  },
]

export function HowItWorks() {
  return (
    <section id="como-funciona" className="py-24 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <span className="inline-block text-sm font-semibold text-brand-600 tracking-wide uppercase mb-4">
            Cómo funciona
          </span>
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight">Tan fácil como 1, 2, 3</h2>
          <p className="mt-4 text-lg text-muted-foreground max-w-xl mx-auto">
            Ordena en segundos y recibe tu pedido en minutos.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {STEPS.map((step) => (
            <div
              key={step.step}
              className="bg-surface-50 rounded-4xl p-8 text-center transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_20px_40px_rgba(0,0,0,0.08)]"
            >
              <div
                className={`w-16 h-16 mx-auto mb-6 rounded-2xl bg-gradient-to-br ${step.gradient} flex items-center justify-center shadow-lg ${step.shadow}`}
              >
                <Icon icon={step.icon} width="32" height="32" className="text-white" />
              </div>
              <div className="text-xs font-bold text-brand-500 mb-3">{step.step}</div>
              <h3 className="text-xl font-bold mb-2">{step.title}</h3>
              <p className="text-muted-foreground leading-relaxed">{step.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
