import { Skeleton } from '@/components/ui/skeleton'

export default function RepartidorLoading() {
  return (
    <div className="flex h-screen overflow-hidden">
      <aside className="hidden lg:flex h-screen w-60 shrink-0 flex-col border-r bg-background px-3 py-4">
        <div className="flex flex-col items-center gap-2 pb-4">
          <Skeleton className="h-9 w-32" />
          <Skeleton className="h-3 w-14" />
        </div>
        <nav className="flex flex-1 flex-col gap-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-full rounded-2xl" />
          ))}
        </nav>
        <div className="flex items-center gap-2 rounded-2xl p-2">
          <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
          <Skeleton className="h-4 w-28" />
        </div>
      </aside>
      <main className="flex-1 overflow-auto px-8 pt-16 pb-6 lg:py-6">
        <div className="space-y-6">
          <div className="space-y-2">
            <Skeleton className="h-7 w-56" />
            <Skeleton className="h-4 w-96" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-2xl" />
            ))}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-2xl" />
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}