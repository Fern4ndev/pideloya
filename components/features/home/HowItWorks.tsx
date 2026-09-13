import { Icon } from '@iconify-icon/react'
import { ScrollStack } from '@/components/ui/scroll-stack'

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

        <ScrollStack
          className="max-w-2xl mx-auto"
          itemDistance={220}
          topOffset={104}
        >
          {STEPS.map((step) => (
            <div
              key={step.step}
              className="bg-card rounded-4xl p-10 md:p-14 border border-border shadow-2xl shadow-black/8"
            >
              <div
                className={`w-20 h-20 rounded-2xl bg-linear-to-br ${step.gradient} flex items-center justify-center shadow-lg ${step.shadow} mb-8`}
              >
                <Icon icon={step.icon} width="36" height="36" className="text-white" />
              </div>
              <div className="text-sm font-bold text-brand-500 mb-3 tracking-wide">{step.step}</div>
              <h3 className="text-3xl font-bold mb-3">{step.title}</h3>
              <p className="text-lg text-muted-foreground leading-relaxed max-w-md">
                {step.description}
              </p>
            </div>
          ))}
        </ScrollStack>
      </div>
    </section>
  )
}