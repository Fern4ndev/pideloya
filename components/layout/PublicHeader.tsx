'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { House, Menu, Store, X } from 'lucide-react'


const navItems = [
  { label: 'Cómo funciona', href: '#como-funciona', icon: House },
  { label: 'Negocios', href: '#unete', icon: Store },
]

export function PublicHeader() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  function closeMenu() {
    setIsMenuOpen(false)
  }

  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-white/6 bg-[#0c0c0e]/95 px-4 py-4 backdrop-blur-[14px] sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl items-center justify-between">
        <Link href="/" onClick={closeMenu} className="text-2xl font-extrabold tracking-[-0.5px] text-white">
          <Image src="/icons/logo-pideloya.svg" alt="PideloYa" width={160} height={40} />
        </Link>

        <div className="hidden items-center gap-8 text-sm text-white/70 md:flex">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="transition-colors duration-200 hover:text-lime"
              onClick={closeMenu}
            >
              {item.label}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="button-lime hidden whitespace-nowrap md:inline-flex"
          >
            Iniciar sesión
          </Link>

          <button
            type="button"
            className="relative z-70 inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-full border border-white/10 text-white transition-colors hover:border-lime hover:text-lime md:hidden"
            aria-label={isMenuOpen ? 'Cerrar menú' : 'Abrir menú'}
            aria-expanded={isMenuOpen}
            aria-controls="mobile-navigation"
            onClick={() => setIsMenuOpen((open) => !open)}
          >
            {isMenuOpen ? <X size={22} aria-hidden="true" /> : <Menu size={22} aria-hidden="true" />}
          </button>
        </div>
      </div>

      {isMenuOpen && (
        <>
          <button
            type="button"
            aria-label="Cerrar menú"
            className="fixed inset-0 z-40 bg-black/60 md:hidden"
            onClick={closeMenu}
          />
          <nav
            id="mobile-navigation"
            aria-label="Navegación móvil"
            className="fixed inset-y-0 right-0 z-60 flex h-dvh w-[min(78vw,320px)] flex-col border-l border-white/10 bg-[#111115] px-4 pb-5 pt-6 text-sm text-white/80 shadow-2xl shadow-black/50 md:hidden"
          >
            <div className="mb-8 flex items-center justify-between border-b border-white/10 px-2 pb-5">
              <Link href="/" onClick={closeMenu} aria-label="PideloYa - Ir al inicio">
                <Image src="/icons/logo-pideloya.svg" alt="PideloYa" width={128} height={32} />
              </Link>
            </div>

          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={closeMenu}
              className="flex items-center gap-3 rounded-xl px-3 py-3.5 transition-colors hover:bg-white/5 hover:text-lime"
            >
              <item.icon size={18} strokeWidth={1.8} aria-hidden="true" />
              {item.label}
            </Link>
          ))}
          <Link
            href="/login"
            onClick={closeMenu}
            className="mt-auto inline-flex items-center justify-center rounded-full bg-lime px-5 py-3 font-bold text-panel transition-transform hover:-translate-y-0.5"
          >
            Iniciar sesión
          </Link>
          </nav>
        </>
      )}
    </header>
  )
}