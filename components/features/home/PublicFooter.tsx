import Image from 'next/image'
import Link from 'next/link'

// lucide-react ya no exporta iconos de marca (Facebook/Instagram se quitaron
// del paquete): al igual que TikTok, se dibujan aquí como SVG propio y
// heredan currentColor.

// TikTok no existe en lucide-react: SVG oficial simplificado (trazo del
// glifo, hereda currentColor como los iconos lucide de al lado).
function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden
    >
      <path d="M16.6 5.82A4.28 4.28 0 0 1 15.54 3h-3.09v12.4a2.59 2.59 0 1 1-2.59-2.59c.27 0 .53.04.78.12V9.77a5.76 5.76 0 0 0-.78-.05 5.66 5.66 0 1 0 5.66 5.66V9.01a7.35 7.35 0 0 0 4.3 1.38V7.3a4.28 4.28 0 0 1-3.22-1.48Z" />
    </svg>
  )
}

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <rect x="2" y="2" width="20" height="20" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  )
}

function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  )
}

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
  { label: 'Instagram', href: '#', Icon: InstagramIcon },
  { label: 'Facebook', href: '#', Icon: FacebookIcon },
  { label: 'TikTok', href: '#', Icon: TikTokIcon },
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
              <social.Icon className="h-[18px] w-[18px]" />
            </a>
          ))}
        </div>
      </div>
    </footer>
  )
}