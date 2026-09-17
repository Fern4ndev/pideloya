import { Icon } from '@iconify-icon/react'
import Link from 'next/link'

export function JoinSection() {
  return (
    <section id="unete" className="relative py-28 px-6 text-white" style={{ background: 'radial-gradient(ellipse 80% 50% at 50% 50%, transparent 0%, rgba(249, 115, 22, 0.25) 100%)' }}>
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-linear-to-b from-transparent via-white/3 to-transparent"
      />
      <div
        aria-hidden="true"
        className="absolute top-0 left-1/2 -translate-x-1/2 w-200 h-100 bg-brand-500/5 rounded-full blur-3xl"
      />

      <div className="relative max-w-5xl mx-auto">
        <div className="text-center mb-14">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-yellow-400/10 px-4 py-1.5 text-xs font-semibold text-yellow-300">
            <Icon icon="lucide:rocket" width="14" height="14" />
            Únete al equipo
          </div>
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-4 text-white">
            Haz parte de{' '}
            <span className="bg-linear-to-r from-brand-500 to-orange-500 bg-clip-text text-transparent">
              PideloYa
            </span>
          </h2>
          <p className="text-lg text-white max-w-lg mx-auto">
            Ya seas restaurante o repartidor, hay un lugar para ti en Abancay.
          </p>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <Link
            href="/registro?tipo=restaurante"
            className="group relative overflow-hidden rounded-[28px] border border-zinc-800/80 bg-zinc-950/80 p-7 shadow-glow backdrop-blur-xl transition duration-500 hover:-translate-y-1 hover:border-yellow-400/30 hover:bg-zinc-900/80"
          >
            <div className="absolute right-0 top-0 h-32 w-32 rounded-full bg-yellow-400/[0.04] blur-3xl transition duration-500 group-hover:bg-yellow-400/[0.09]" />
            <div className="relative">
              <div className="mb-7 flex h-14 w-14 items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-900 text-yellow-400 transition duration-500 group-hover:border-yellow-400/30 group-hover:shadow-glowStrong">
                <Icon icon="lucide:store" width="28" height="28" />
              </div>
              <h3 className="text-xl font-semibold tracking-tight text-white">Soy restaurante</h3>
              <p className="mt-3 min-h-[72px] text-sm leading-6 text-zinc-400">
                Registra tu negocio y llega a más clientes en Abancay.
              </p>
              <span className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-yellow-300">
                Registrar negocio
                <Icon icon="lucide:arrow-right" width="16" height="16" className="transition-transform group-hover:translate-x-1" />
              </span>
            </div>
          </Link>

          <Link
            href="/registro?tipo=repartidor"
            className="group relative overflow-hidden rounded-[28px] border border-zinc-800/80 bg-zinc-950/80 p-7 shadow-glow backdrop-blur-xl transition duration-500 hover:-translate-y-1 hover:border-yellow-400/30 hover:bg-zinc-900/80"
          >
            <div className="absolute right-0 top-0 h-32 w-32 rounded-full bg-yellow-400/[0.04] blur-3xl transition duration-500 group-hover:bg-yellow-400/[0.09]" />
            <div className="relative">
              <div className="mb-7 flex h-14 w-14 items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-900 text-yellow-400 transition duration-500 group-hover:border-yellow-400/30 group-hover:shadow-glowStrong">
                <Icon icon="lucide:zap" width="28" height="28" />
              </div>
              <h3 className="text-xl font-semibold tracking-tight text-white">Soy repartidor</h3>
              <p className="mt-3 min-h-[72px] text-sm leading-6 text-zinc-400">
                Reparte a tu ritmo, recibe pedidos y genera ingresos en tu ciudad.
              </p>
              <span className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-yellow-300">
                Quiero repartir
                <Icon icon="lucide:arrow-right" width="16" height="16" className="transition-transform group-hover:translate-x-1" />
              </span>
            </div>
          </Link>
        </div>
      </div>
    </section>
  )
}