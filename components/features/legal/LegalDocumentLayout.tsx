import type { ReactNode } from 'react'
import Link from 'next/link'
import { Icon } from '@iconify-icon/react'

const LEGAL_LINKS = [
  { label: 'Términos y Condiciones', href: '/terminos' },
  { label: 'Política de Privacidad', href: '/privacidad' },
]

export function LegalDocumentLayout({
  title,
  updatedAt,
  children,
}: {
  title: string
  updatedAt: string
  children: ReactNode
}) {
  return (
    <div className="px-6 py-16 md:py-24">
      <div className="max-w-3xl mx-auto">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <Icon icon="lucide:arrow-left" width="15" height="15" />
          Volver al inicio
        </Link>

        <h1 className="mt-6 text-3xl md:text-4xl font-bold tracking-tight">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">Última actualización: {updatedAt}</p>

        <div className="mt-6 flex flex-wrap gap-2">
          {LEGAL_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-full border border-border/60 px-3.5 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:border-border transition-colors"
            >
              {link.label}
            </Link>
          ))}
        </div>

        <div className="section-divider my-10" />

        <div className="space-y-10">{children}</div>
      </div>
    </div>
  )
}

export function LegalSection({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-xl font-bold tracking-tight">{title}</h2>
      <div className="space-y-3 text-[15px] leading-relaxed text-muted-foreground">
        {children}
      </div>
    </section>
  )
}
