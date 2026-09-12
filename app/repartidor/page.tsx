import Link from 'next/link'
import { DeliveryDashboardCards } from '@/components/features/deliveries/DeliveryDashboardCards'
import { PageHeader } from '@/components/layout/PageHeader'
import { PageContainer } from '@/components/layout/PageContainer'
import { Card, CardContent } from '@/components/ui/card'
import { MapPinIcon, PackageIcon, ChevronRightIcon } from 'lucide-react'

const QUICK_LINKS = [
  {
    href: '/repartidor/disponibles',
    title: 'Ver pedidos disponibles',
    description: 'Acepta un pedido nuevo para empezar a repartirlo.',
    icon: MapPinIcon,
  },
  {
    href: '/repartidor/pedidos',
    title: 'Mis entregas',
    description: 'Revisa y actualiza el estado de lo que ya aceptaste.',
    icon: PackageIcon,
  },
]

export default function RepartidorHomePage() {
  return (
    <PageContainer size="lg">
      <PageHeader
        title="Panel de reparto"
        description="Ve a Disponibles para aceptar pedidos, o Mis entregas para ver los que ya tienes asignados."
      />

      <div className="mt-6 space-y-6">
        <DeliveryDashboardCards />

        <div className="grid gap-4 sm:grid-cols-2">
          {QUICK_LINKS.map((link) => (
            <Link key={link.href} href={link.href}>
              <Card className="h-full transition-colors hover:bg-muted/40">
                <CardContent className="flex items-center gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <link.icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{link.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {link.description}
                    </p>
                  </div>
                  <ChevronRightIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </PageContainer>
  )
}