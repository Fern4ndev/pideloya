import type { Metadata } from 'next'
import Script from 'next/script'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import './globals.css'

export const metadata: Metadata = {
  title: 'PideloYa — Pedidos en Abancay',
  description: 'Pide en tus negocios favoritos de Abancay, Apurímac.',
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
      </body>
    </html>
  )
}