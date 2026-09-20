import Link from 'next/link'
import { Icon } from '@iconify-icon/react'
import { RegistrationForms } from '@/components/features/registration/RegistrationForms'
import { PublicFooter } from '@/components/features/home/PublicFooter'

type RegistroPageProps = {
  searchParams: Promise<{ tipo?: string }>
}

export default async function RegistroPage({ searchParams }: RegistroPageProps) {
  const { tipo } = await searchParams
  const isRepartidor = tipo === 'repartidor'

  return (
    <>
      <main
        className="relative min-h-screen overflow-hidden px-6 pb-20 pt-36"
        style={{ backgroundColor: '#faf8f2' }}
      >
        {/* Aura Gradient Layers */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'radial-gradient(ellipse 45% 50% at 30% 40%, rgba(192,132,252,0.55) 0%, transparent 60%)',
            filter: 'blur(163px)',
          }}
          className="pointer-events-none md:blur-[234px]"
          aria-hidden="true"
        />
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'radial-gradient(ellipse 35% 40% at 70% 35%, rgba(168,85,247,0.45) 0%, transparent 55%)',
            filter: 'blur(138px)',
          }}
          className="pointer-events-none md:blur-[198px]"
          aria-hidden="true"
        />
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'radial-gradient(ellipse 30% 35% at 50% 75%, rgba(216,180,254,0.35) 0%, transparent 50%)',
            filter: 'blur(125px)',
          }}
          className="pointer-events-none md:blur-[180px]"
          aria-hidden="true"
        />
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'radial-gradient(ellipse 20% 22% at 80% 65%, rgba(233,213,255,0.4) 0%, transparent 45%)',
            filter: 'blur(100px)',
          }}
          className="pointer-events-none md:blur-[144px]"
          aria-hidden="true"
        />

        {/* Content */}
        <div className="relative z-10 mx-auto max-w-4xl">
          <Link href="/#unete" className="mb-8 inline-flex items-center gap-2 text-sm text-neutral-500 transition-colors hover:text-purple-700">
            <Icon icon="lucide:arrow-left" width="16" height="16" />
            Volver a opciones
          </Link>

          <div className="mb-10 text-center">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-purple-100 px-4 py-1.5 text-xs font-semibold text-purple-700">
              <Icon icon={isRepartidor ? 'lucide:zap' : 'lucide:store'} width="14" height="14" />
              Registro de {isRepartidor ? 'repartidor' : 'restaurante'}
            </div>
            <h1 className="text-4xl font-bold tracking-tight text-neutral-900 md:text-5xl">
              {isRepartidor ? 'Conviértete en repartidor' : 'Registra tu negocio'}
            </h1>
            <p className="mx-auto mt-4 max-w-lg text-lg text-neutral-600">
              {isRepartidor
                ? 'Completa tus datos y empieza a repartir a tu ritmo.'
                : 'Completa tus datos para llegar a más clientes en Abancay.'}
            </p>
          </div>

          <RegistrationForms tipo={tipo ?? ''} />
        </div>
      </main>
      <PublicFooter />
    </>
  )
}
