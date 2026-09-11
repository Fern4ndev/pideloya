import { PublicHeader } from '@/components/layout/PublicHeader'
import { PublicFooter } from '@/components/features/home/PublicFooter'

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-background">
      <PublicHeader />
      <main >{children}</main>
      <PublicFooter />
    </div>
  )
}
