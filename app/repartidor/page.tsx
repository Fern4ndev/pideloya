import { DeliveryDashboardCards } from '@/components/features/deliveries/DeliveryDashboardCards'
import { PageHeader } from '@/components/layout/PageHeader'
import { PageContainer } from '@/components/layout/PageContainer'

export default function RepartidorHomePage() {
  return (
    <PageContainer size="lg">
      <PageHeader
        title="Panel de reparto"
        description="Usa el menú de la izquierda para ir a Disponibles (aceptar pedidos) o Mis entregas (los que ya tienes asignados)."
      />

      <div className="mt-6">
        <DeliveryDashboardCards />
      </div>
    </PageContainer>
  )
}