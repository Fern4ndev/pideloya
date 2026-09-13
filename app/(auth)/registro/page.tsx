import Link from 'next/link'
import { Icon } from '@iconify-icon/react'
import { DeliveryRegisterForm } from '@/components/features/registration/DeliveryRegisterForm'
import { RestaurantRegisterForm } from '@/components/features/registration/RestaurantRegisterForm'

type RegistroPageProps = {
  searchParams: Promise<{ tipo?: string }>
}

export default async function RegistroPage({ searchParams }: RegistroPageProps) {
  const { tipo } = await searchParams
  const isRepartidor = tipo === 'repartidor'

  return (
    <main className="min-h-screen bg-[#0c0c0e] px-6 pb-20 pt-36 text-white">
      <div className="mx-auto max-w-4xl">
        <Link href="/#unete" className="mb-8 inline-flex items-center gap-2 text-sm text-zinc-400 transition-colors hover:text-yellow-300">
          <Icon icon="lucide:arrow-left" width="16" height="16" />
          Volver a opciones
        </Link>

        <div className="mb-10 text-center">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-yellow-400/10 px-4 py-1.5 text-xs font-semibold text-yellow-300">
            <Icon icon={isRepartidor ? 'lucide:zap' : 'lucide:store'} width="14" height="14" />
            Registro de {isRepartidor ? 'repartidor' : 'restaurante'}
          </div>
          <h1 className="text-4xl font-bold tracking-tight md:text-5xl">
            {isRepartidor ? 'Conviértete en repartidor' : 'Registra tu negocio'}
          </h1>
          <p className="mx-auto mt-4 max-w-lg text-lg text-zinc-400">
            {isRepartidor
              ? 'Completa tus datos y empieza a repartir a tu ritmo.'
              : 'Completa tus datos para llegar a más clientes en Abancay.'}
          </p>
        </div>

        {isRepartidor ? <DeliveryRegisterForm /> : <RestaurantRegisterForm />}
      </div>
    </main>
  )
}
