export function FormError({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <div className="rounded-xl border border-red-200/60 bg-red-50/80 backdrop-blur-sm px-4 py-3 text-[14px] text-red-600">
      {message}
    </div>
  )
}
