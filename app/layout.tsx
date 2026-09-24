import type { Metadata } from 'next'
import Script from 'next/script'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import { Toaster } from 'sonner'
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
        <Script
          src="https://cdn.jsdelivr.net/npm/iconify-icon@3/dist/iconify-icon.min.js"
          strategy="beforeInteractive"
        />
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  )
}