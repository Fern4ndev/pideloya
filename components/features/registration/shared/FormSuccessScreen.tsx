interface FormSuccessScreenProps {
  title: string
  description: string
}

export function FormSuccessScreen({
  title,
  description,
}: FormSuccessScreenProps) {
  return (
    <div className="rounded-2xl border border-zinc-800/80 bg-zinc-950 p-12 text-center">
      <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full border border-zinc-800 bg-zinc-900">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-white">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>
      <h3 className="text-[22px] font-semibold text-white mb-2">
        {title}
      </h3>
      <p className="mx-auto max-w-sm text-[15px] leading-relaxed text-zinc-400">
        {description}
      </p>
      <div className="mt-8 inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900/50 px-4 py-2 text-[13px] text-zinc-400">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
        Respuesta en menos de 24 horas
      </div>
    </div>
  )
}
