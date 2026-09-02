import Link from 'next/link'
import { Icon } from '@iconify-icon/react'
import { SearchBar } from '@/components/features/home/SearchBar'

export function PublicHeader() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-border">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-brand-500 to-brand-600 flex items-center justify-center">
            <Icon icon="lucide:plus" width="20" height="20" className="text-white" />
          </div>
          <span className="text-lg font-bold tracking-tight">PideloYa</span>
        </Link>

        <SearchBar />

        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors px-4 py-2"
          >
            Ingresar
          </Link>
          <Link
            href="/login"
            className="btn-brand text-sm font-semibold text-white px-5 py-2.5 rounded-full"
          >
            Pedir ahora
          </Link>
        </div>
      </div>
    </header>
  )
}
