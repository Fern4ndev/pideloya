import { Icon } from '@iconify-icon/react'
import Image from 'next/image'
import Link from 'next/link'

const PRODUCT_LINKS = [
  { label: 'Cómo funciona', href: '/#como-funciona' },
  { label: 'Categorías', href: '/#categorias' },
  { label: 'Restaurantes', href: '/restaurantes' },
  { label: 'Buscar', href: '/buscar' },
]

const JOIN_LINKS = [
  { label: 'Registra tu restaurante', href: '/#unete' },
  { label: 'Sé repartidor', href: '/#unete' },
  { label: 'Iniciar sesión', href: '/login' },
]

const LEGAL_LINKS = [
  { label: 'Privacidad', href: '/privacidad' },
  { label: 'Términos', href: '/terminos' },
]

const SOCIAL_LINKS = [
  { label: 'Instagram', href: '#', icon: 'mdi:instagram' },
  { label: 'Facebook', href: '#', icon: 'mdi:facebook' },
  { label: 'TikTok', href: '#', icon: 'ic:baseline-tiktok' },
]

export function PublicFooter() {
  return (
    <footer role="contentinfo" className="border-t border-white/10 bg-[#0c0c0e] pt-16 pb-8 text-white">
      <div className="mx-auto mb-16 flex max-w-7xl flex-col justify-between gap-12 px-6 md:flex-row">
        <div className="w-full md:w-1/3">
          <Link
            href="/"
            className="mb-4 inline-flex items-center gap-2"
            aria-label="PideloYa - Ir al inicio"
          >
            <Image src="/icons/logo-pideloya.svg" alt="PideloYa" width={150} height={38} />
          </Link>
          <p className="text-sm leading-relaxed text-neutral-400">
            La forma más rápida de pedir{' '}
            comida,{' '}
            mercado y{' '}
            farmacia en Abancay.
            Repartidores locales y entrega promedio de 12 minutos.
          </p>
        </div>

        <div className="flex flex-wrap gap-12 md:gap-16">
          <nav aria-label="Producto">
            <h4 className="mb-4 text-sm font-medium text-white">Producto</h4>
            <ul className="space-y-3 text-sm text-neutral-400">
              {PRODUCT_LINKS.map((link) => (
                <li key={link.label}>
                  <Link href={link.href} className="transition-colors hover:text-white">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label="Únete">
            <h4 className="mb-4 text-sm font-medium text-white">Únete</h4>
            <ul className="space-y-3 text-sm text-neutral-400">
              {JOIN_LINKS.map((link) => (
                <li key={link.label}>
                  <Link href={link.href} className="transition-colors hover:text-white">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label="Contacto">
            <h4 className="mb-4 text-sm font-medium text-white">Contacto</h4>
            <ul className="space-y-3 text-sm text-neutral-400">
              <li>
                <a href="mailto:hola@pideloya.pe" className="transition-colors hover:text-white">
                  E-mail
                </a>
              </li>
            </ul>
          </nav>

          <nav aria-label="Legal">
            <h4 className="mb-4 text-sm font-medium text-white">Legal</h4>
            <ul className="space-y-3 text-sm text-neutral-400">
              {LEGAL_LINKS.map((link) => (
                <li key={link.label}>
                  <Link href={link.href} className="transition-colors hover:text-white">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </div>

      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 border-t border-white/10 px-6 pt-8 md:flex-row">
        <span className="text-xs text-neutral-400">
          © 2026 PideloYa · Hecho con hambre y cariño
        </span>

        <div className="flex gap-4 text-white" aria-label="Redes sociales">
          {SOCIAL_LINKS.map((social) => (
            <a
              key={social.label}
              href={social.href}
              aria-label={social.label}
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors hover:text-lime"
            >
              <Icon icon={social.icon} width="18" height="18" />
            </a>
          ))}
        </div>
      </div>
    </footer>
  )
}