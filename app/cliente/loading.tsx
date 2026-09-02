export default function ClienteLoading() {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div className="h-5 w-20 bg-muted rounded animate-pulse" />
          <div className="flex gap-4">
            <div className="h-8 w-16 bg-muted rounded-full animate-pulse" />
            <div className="h-8 w-16 bg-muted rounded-full animate-pulse" />
            <div className="h-9 w-9 bg-muted rounded-full animate-pulse" />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">
        <div className="space-y-6">
          <div className="h-8 w-48 bg-muted rounded animate-pulse" />
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-48 bg-muted rounded-xl animate-pulse" />
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}
