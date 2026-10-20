import { SearchIcon } from 'lucide-react'

export function SearchBar() {
  return (
    <div className="hidden md:flex flex-1 max-w-md mx-8">
      <div className="relative w-full">
        <SearchIcon
          className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <input
          type="search"
          placeholder="Buscar restaurantes o platos..."
          className="w-full h-10 pl-10 pr-4 rounded-full bg-muted border border-border text-sm outline-none placeholder:text-muted-foreground focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-500/10 transition-all"
        />
      </div>
    </div>
  )
}
