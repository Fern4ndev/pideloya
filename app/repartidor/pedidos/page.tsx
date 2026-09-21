import { DeliveryOrdersClient } from '@/components/features/deliveries/DeliveryOrdersClient'
import { PageHeader } from '@/components/layout/PageHeader'
import { PageContainer } from '@/components/layout/PageContainer'

export default function DeliveryOrdersPage() {
  return (
    <PageContainer size="md">
      <PageHeader
        title="Mis entregas"
        description="Pedidos que tienes asignados ahora mismo."
      />
      <DeliveryOrdersClient />
    </PageContainer>
  )
}
