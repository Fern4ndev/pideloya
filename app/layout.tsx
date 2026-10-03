import type { Metadata } from 'next'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import { Toaster } from '@/components/ui/toast'
import { SwrProvider } from '@/components/providers/swr-provider'
import './globals.css'

export const metadata: Metadata = {
  title: 'PideloYa',
  description: 'Pide en tus negocios favoritos de Abancay, Apurímac.',
  icons: {
    icon: "/icons/favicon.svg"
  }
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="font-sans antialiased">
        {/* Script de iconify eliminado (Fase 4): todos los iconos son ahora
            lucide-react inline — un request de CDN menos y cero flash de
            iconos vacíos en primera pintura. */}
        <SwrProvider>{children}</SwrProvider>
        <Toaster position="top-right" />
      </body>
    </html>
  )
}