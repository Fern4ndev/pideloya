export function FieldError({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <p className="text-[13px] text-red-400/90 mt-1.5">{message}</p>
  )
}
