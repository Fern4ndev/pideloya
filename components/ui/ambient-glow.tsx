import { cn } from '@/lib/utils'

interface AmbientGlowProps {
  className?: string
}

export function AmbientGlow({ className }: AmbientGlowProps) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-[48rem] h-full z-0 overflow-visible flex justify-center',
        className
      )}
    >
      <div
        className="absolute inset-0 -top-28 bottom-64 w-full h-full mix-blend-hard-light blur-[80px] md:blur-[120px] transform-gpu will-change-transform"
        style={{
          background:
            'linear-gradient(rgba(0,0,0,0) 0%, rgba(139,123,255,0.10) 20%, rgb(255,255,255) 45%, rgba(255,77,46,0.75) 75%, rgba(216,255,62,0.55) 100%)',
        }}
      />
      <div
        className="absolute inset-0 -top-28 bottom-64 w-full h-full mix-blend-soft-light blur-[80px] md:blur-[120px] transform-gpu will-change-transform"
        style={{
          background:
            'linear-gradient(rgba(0,0,0,0) 0%, rgba(139,123,255,0.18) 35%, rgb(255,255,255) 70%, rgba(255,77,46,0.5) 80%, rgba(216,255,62,0.35) 100%)',
        }}
      />
    </div>
  )
}
