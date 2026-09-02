import { Icon } from '@iconify-icon/react'

export function SearchBar() {
  return (
    <div className="hidden md:flex flex-1 max-w-md mx-8">
      <div className="relative w-full">
        <Icon
          icon="lucide:search"
          className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          width="16"
          height="16"
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
