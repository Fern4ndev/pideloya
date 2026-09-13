import { HeroSection } from '@/components/features/home/HeroSection'
import { HowItWorks } from '@/components/features/home/HowItWorks'
import { JoinSection } from '@/components/features/registration/JoinSection'
import { AmbientGlow } from '@/components/ui/ambient-glow'

export default function HomePage() {
  return (
    <div className="home-surface relative isolate overflow-hidden">
      <AmbientGlow className="top-0 h-full" />
      <HeroSection />

      <div className="relative z-10">
        <HowItWorks />
        <JoinSection />
      </div>
    </div>
  )
}
