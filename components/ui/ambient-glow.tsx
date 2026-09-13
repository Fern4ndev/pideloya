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
            'linear-gradient(rgba(0,0,0,0) 0%, rgba(0,138,255,0.1) 20%, rgb(255,255,255) 45%, rgb(247,164,66) 75%, rgb(233,66,247) 100%)',
        }}
      />
      <div
        className="absolute inset-0 -top-28 bottom-64 w-full h-full mix-blend-soft-light blur-[80px] md:blur-[120px] transform-gpu will-change-transform"
        style={{
          background:
            'linear-gradient(rgba(0,0,0,0) 0%, rgba(0,138,255,0.2) 35%, rgb(255,255,255) 70%, rgb(247,164,66) 80%, rgb(233,66,247) 100%)',
        }}
      />
    </div>
  )
}
