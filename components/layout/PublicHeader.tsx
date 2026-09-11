import Image from 'next/image'
import Link from 'next/link'

const navItems = [
  { label: 'Cómo funciona', href: '#como-funciona' },
  { label: 'Categorías', href: '#categorias' },
  { label: 'Negocios', href: '#unete' },
]

export function PublicHeader() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-white/[0.06] bg-[#0c0c0e]/95 px-[5vw] py-[16px] backdrop-blur-[14px]">
      <div className="mx-auto flex max-w-[1600px] items-center justify-between">
        <Link href="/" className="text-2xl font-extrabold tracking-[-0.5px] text-white">
          <Image src="/icons/logo-pideloya.svg" alt="PideloYa" width={160} height={40} />
        </Link>

        <div className="hidden items-center gap-8 text-sm text-white/70 md:flex">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="transition-colors duration-200 hover:text-lime"
            >
              {item.label}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="px-4 py-2 text-sm font-medium text-white/80 transition-colors duration-200 hover:text-lime"
          >
            Ingresar
          </Link>
          <Link href="/registro" className="button-lime">
            Regístrate
          </Link>
        </div>
      </div>
    </header>
  )
}