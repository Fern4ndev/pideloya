export default function AdminLoading() {
  return (
    <div className="flex h-screen">
      <aside className="flex h-screen w-56 shrink-0 flex-col border-r bg-background px-3 py-4">
        <div className="px-2 pb-4 text-base font-semibold tracking-tight">
          PideloYa <span className="text-muted-foreground">· Admin</span>
        </div>
        <nav className="flex flex-1 flex-col gap-1">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-8 rounded-md bg-muted animate-pulse" />
          ))}
        </nav>
      </aside>
      <main className="flex-1 overflow-auto p-8">
        <div className="space-y-6">
          <div className="h-8 w-48 bg-muted rounded animate-pulse" />
          <div className="h-96 bg-muted rounded-xl animate-pulse" />
        </div>
      </main>
    </div>
  )
}
