import { Icon } from '@iconify-icon/react'

const FEATURES = [
  {
    title: 'Entrega ultrarrápida',
    description: 'Repartidores locales que conocen Abancay. Tu pedido llega en minutos, no en horas.',
    icon: 'lucide:clock',
    gradient: 'from-brand-50 to-orange-50',
    border: 'border-brand-100',
    iconBg: 'bg-brand-500',
  },
  {
    title: 'Seguro y confiable',
    description: 'Paga con confianza. Tus datos están protegidos y cada repartidor es verificado.',
    icon: 'lucide:shield-check',
    gradient: 'from-blue-50 to-indigo-50',
    border: 'border-blue-100',
    iconBg: 'bg-blue-500',
  },
  {
    title: 'Apoya lo local',
    description: 'Cada pedido fortalece los negocios de tu comunidad. Compra local, consume con propósito.',
    icon: 'lucide:heart',
    gradient: 'from-purple-50 to-pink-50',
    border: 'border-purple-100',
    iconBg: 'bg-purple-500',
  },
  {
    title: 'Notificaciones en tiempo real',
    description: 'Sabes exactamente dónde está tu pedido. Desde el restaurante hasta tu puerta.',
    icon: 'lucide:bell',
    gradient: 'from-emerald-50 to-teal-50',
    border: 'border-emerald-100',
    iconBg: 'bg-emerald-500',
  },
]

export function Features() {
  return (
    <section id="categorias" className="py-24 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <span className="inline-block text-sm font-semibold text-brand-600 tracking-wide uppercase mb-4">
            ¿Por qué PideloYa?
          </span>
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight">Diseñado para Abancay</h2>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {FEATURES.map((feature) => (
            <div
              key={feature.title}
              className={`bg-gradient-to-br ${feature.gradient} rounded-4xl p-8 border ${feature.border} transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_20px_40px_rgba(0,0,0,0.08)]`}
            >
              <div
                className={`w-12 h-12 rounded-xl ${feature.iconBg} flex items-center justify-center mb-5`}
              >
                <Icon icon={feature.icon} width="24" height="24" className="text-white" />
              </div>
              <h3 className="text-xl font-bold mb-3">{feature.title}</h3>
              <p className="text-muted-foreground leading-relaxed">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}