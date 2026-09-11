import { Icon } from '@iconify-icon/react'
import Image from 'next/image'
import Link from 'next/link'

const footerLinks = [
  { label: 'Cómo funciona', href: '#como-funciona' },
  { label: 'Categorías', href: '#categorias' },
  { label: 'Negocios', href: '#unete' },
]

export function PublicFooter() {
  return (
    <footer className="border-t border-white/[0.07] bg-[#0c0c0e] px-[5vw] py-10 text-white">
      <div className="mx-auto flex max-w-[1600px] flex-col items-center justify-between gap-6 md:flex-row">
        <Link href="/" className="text-2xl font-extrabold tracking-[-0.5px]">
          <Image src="/icons/logo-pideloya.svg" alt="PideloYa" width={160} height={40} />
        </Link>

        <div className="flex items-center gap-6">
          {footerLinks.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="hidden text-sm text-[#9b978c] transition-colors hover:text-lime sm:block"
            >
              {item.label}
            </Link>
          ))}
        </div>
        <p className="text-center text-xs text-[#9b978c] md:text-right">
          © 2026 PideloYa · Hecho con hambre y cariño
        </p>
        <div className="flex items-center gap-4 text-[#9b978c]">
          <Link
            href="#"
            aria-label="Instagram"
            className="transition-colors hover:text-lime"
          >
            <Icon icon="mdi:instagram" className="text-xl" />
          </Link>

          <Link
            href="#"
            aria-label="Facebook"
            className="transition-colors hover:text-lime"
          >
            <Icon icon="mdi:facebook" className="text-xl" />
          </Link>

          <Link
            href="#"
            aria-label="TikTok"
            className="transition-colors hover:text-lime"
          >
            <Icon icon="ic:baseline-tiktok" className="text-xl" />
          </Link>
        </div>
      </div>
    </footer>
  )
}