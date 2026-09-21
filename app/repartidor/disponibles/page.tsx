import { AvailableOrdersClient } from '@/components/features/deliveries/AvailableOrdersClient'
import { PageHeader } from '@/components/layout/PageHeader'
import { PageContainer } from '@/components/layout/PageContainer'

export default function AvailableOrdersPage() {
  return (
    <PageContainer size="md">
      <PageHeader
        title="Pedidos disponibles"
        description="Acepta un pedido para empezar a repartirlo."
      />
      <AvailableOrdersClient />
    </PageContainer>
  )
}
