import Link from 'next/link'
import Image from 'next/image'


/**
 * Fondo "Nebula Core" (aura gradient, 5 capas radiales + blend modes).
 * La capa base sólida (#100e0b) vive dentro del propio wrapper en vez
 * del <body> — así el efecto queda contenido a esta sección sin tocar
 * el fondo global de la página.
 */
function NebulaBackground() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0">
      {/* Base — sustituye al body como backdrop de los blend modes */}
      <div className="absolute inset-0" style={{ backgroundColor: '#100e0b' }} />

      {/* Layer 1 — screen, violeta */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(circle at 25% 30%, rgba(139,92,246,0.6) 0%, transparent 45%)',
          mixBlendMode: 'screen',
          filter: 'blur(200px)',
          transform: 'translateZ(0)',
        }}
      />

      {/* Layer 2 — screen, rosa */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(circle at 75% 25%, rgba(236,72,153,0.5) 0%, transparent 40%)',
          mixBlendMode: 'screen',
          filter: 'blur(188px)',
          transform: 'translateZ(0)',
        }}
      />

      {/* Layer 3 — screen, azul */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(circle at 50% 75%, rgba(59,130,246,0.5) 0%, transparent 50%)',
          mixBlendMode: 'screen',
          filter: 'blur(200px)',
          transform: 'translateZ(0)',
        }}
      />

      {/* Layer 4 — overlay, amarillo tenue */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(circle at 20% 80%, rgba(250,204,21,0.2) 0%, transparent 35%)',
          mixBlendMode: 'overlay',
          filter: 'blur(138px)',
          transform: 'translateZ(0)',
        }}
      />

      {/* Layer 5 — screen, highlight blanco */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(circle at 85% 70%, rgba(255,255,255,0.1) 0%, transparent 25%)',
          mixBlendMode: 'screen',
          filter: 'blur(100px)',
          transform: 'translateZ(0)',
        }}
      />
    </div>
  )
}

export function JoinSection() {
  return (
    <section
      id="unete"
      className="relative overflow-hidden border-t border-white/[0.06] px-6 py-24"
    >
      <NebulaBackground />

      {/* grid sutil, por encima del aura, debajo del contenido */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.05]"
        style={{
          backgroundImage:
            'linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)',
          backgroundSize: '64px 64px',
        }}
      />

      <div className="relative z-10 mx-auto max-w-5xl">
        <div className="mb-16 max-w-xl">
          <p className="text-sm font-medium text-white/60">Únete</p>
          <h2 className="mt-3 text-4xl font-semibold tracking-[-0.02em] text-white sm:text-5xl">
            Hay un lugar para ti en PideloYa
          </h2>
          <p className="mt-4 text-base leading-relaxed text-white/55">
            Restaurante o repartidor — el registro toma menos de dos minutos.
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          {/* Restaurante — tinte coral de la paleta, coherente con el aura */}
          <div className="group relative overflow-hidden rounded-2xl border border-coral/15 bg-coral/[0.06] p-8 backdrop-blur-sm transition duration-300 sm:p-10">
            {/* Imagen superpuesta ocupando el 70% con degradado a transparente hacia la izquierda */}
            <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-[70%] sm:block [mask-image:linear-gradient(to_right,transparent_0%,black_50%)]">
              <Image
                src="/images/restaurant.avif"
                alt="Restaurante"
                fill
                loading="eager"
                className="object-cover object-center"
                sizes="70vw"
              />
            </div>

            {/* Contenido del texto por encima de la imagen */}
            <div className="relative z-10 flex flex-col justify-between sm:max-w-xs md:max-w-sm">
              <div>
                <h3 className="text-2xl font-semibold tracking-tight text-white">
                  Soy restaurante
                </h3>
                <p className="mt-2.5 max-w-[26ch] text-sm leading-relaxed text-white/55">
                  Publica tu carta y llega a más clientes en Abancay.
                </p>
              </div>

              <Link
                href="/registro?tipo=restaurante"
                className="mt-10 inline-flex w-fit items-center gap-2 rounded-full bg-lime px-6 py-3 text-sm font-semibold text-panel transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_10px_32px_rgba(216,255,62,0.35)] active:translate-y-0"
              >
                Registrar negocio
              </Link>
            </div>
          </div>

          {/* Repartidor — tinte violeta de la paleta */}
          <div className="group relative overflow-hidden rounded-2xl border border-violet/15 bg-violet/[0.06] p-8 backdrop-blur-sm transition duration-300 sm:p-10">
            {/* Imagen superpuesta — placeholder, reemplaza la ruta */}
            <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-[70%] sm:block [mask-image:linear-gradient(to_right,transparent_0%,black_50%)]">
              <Image
                src="/images/delivery.avif"
                alt="Repartidor"
                fill
                className="object-cover object-center"
                sizes="70vw"
              />
            </div>

            {/* Contenido del texto por encima de la imagen */}
            <div className="relative z-10 flex flex-col justify-between sm:max-w-xs md:max-w-sm">
              <div>
                <h3 className="text-2xl font-semibold tracking-tight text-white">
                  Soy repartidor
                </h3>
                <p className="mt-2.5 max-w-[26ch] text-sm leading-relaxed text-white/55">
                  Reparte a tu ritmo y genera ingresos en tu ciudad.
                </p>
              </div>

              <Link
                href="/registro?tipo=repartidor"
                className="mt-10 inline-flex w-fit items-center gap-2 rounded-full bg-lime px-6 py-3 text-sm font-semibold text-panel transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_10px_32px_rgba(216,255,62,0.35)] active:translate-y-0"
              >
                Quiero repartir
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}