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
      {/* Filtros por fila (Fase 2): sin ellos el repartidor recibía eventos de
          TODOS los pedidos/entregas del sistema y cada cambio ajeno refrescaba
          esta pantalla. RLS limita la LECTURA, no la emisión de postgres_changes. */}
      <RealtimeRefresh
        channelName="delivery-order-detail"
        table="orders"
        event="*"
        filter={`id=eq.${id}`}
        syncOnSubscribe
        refreshOnFocus
      />
      <RealtimeRefresh
        channelName="delivery-order-detail-deliveries"
        table="deliveries"
        event="*"
        filter={`order_id=eq.${id}`}
        syncOnSubscribe
        refreshOnFocus
      />
      <DeliveryDetail orderId={id} />
    </PageContainer>
  )
}
