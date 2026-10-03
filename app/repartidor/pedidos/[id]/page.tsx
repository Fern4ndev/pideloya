import { DeliveryDetail } from '@/components/features/deliveries/DeliveryDetail'
import { PageHeader } from '@/components/layout/PageHeader'
import { PageContainer } from '@/components/layout/PageContainer'
import { RealtimeRefresh } from '@/components/ui/realtime-refresh'

export default async function DeliveryOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  return (
    <PageContainer size="md">
      <PageHeader
        title="Detalle de la entrega"
        description="Revisa el pedido y avanza su estado."
      />
      <RealtimeRefresh
        channelName="delivery-order-detail"
        table="orders"
        syncOnSubscribe
        refreshOnFocus
      />
      <RealtimeRefresh
        channelName="delivery-order-detail-deliveries"
        table="deliveries"
        syncOnSubscribe
        refreshOnFocus
      />
      <DeliveryDetail orderId={id} />
    </PageContainer>
  )
}
