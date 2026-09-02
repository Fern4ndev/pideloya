import { HeroSection } from '@/components/features/home/HeroSection'
import { HowItWorks } from '@/components/features/home/HowItWorks'
import { Features } from '@/components/features/home/Features'
import { JoinSection } from '@/components/features/registration/JoinSection'

export default function HomePage() {
  return (
    <main>
      <HeroSection />
      <div className="section-divider max-w-6xl mx-auto" />
      <HowItWorks />
      <div className="section-divider max-w-6xl mx-auto" />
      <Features />
      <div className="section-divider max-w-6xl mx-auto" />
      <JoinSection />
    </main>
  )
}
