import Link from 'next/link'
import { createClient } from '@/lib/db/server'
import { ACTIVE_DELIVERY_STATUSES } from '@/lib/admin/delivery-lifecycle'
import { DeliveryDetail } from '@/components/features/deliveries/DeliveryDetail'
import { RealtimeRefresh } from '@/components/ui/realtime-refresh'
import { EmptyState } from '@/components/ui/empty-state'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/layout/PageHeader'
import { PageContainer } from '@/components/layout/PageContainer'

export default async function DeliveryOrdersPage() {
  const supabase = await createClient()

  // RLS (orders_select_delivery) solo devuelve pedidos PENDING o asignados a
  // este repartidor; ACTIVE_DELIVERY_STATUSES excluye PENDING, así que la fila
  // —si existe— es necesariamente suya. La BD ya garantiza que como máximo hay
  // una entrega activa por repartidor, así que `limit(1)` basta.
  const { data: activeOrder } = await supabase
    .from('orders')
    .select('id')
    .in('status', [...ACTIVE_DELIVERY_STATUSES])
    .limit(1)
    .maybeSingle()

  return (
    <PageContainer size="md">
      <PageHeader
        title="Mi entrega"
        description={
          activeOrder
            ? 'Revisa el pedido y avanza su estado.'
            : 'No tienes ninguna entrega en curso.'
        }
      />

      {/* La pantalla espera datos de OTROS (que el cliente confirme el pago o
          cancele): sin realtime, el repartidor vería la oferta muerta hasta un
          refresh manual. `syncOnSubscribe`/`refreshOnFocus` cierran las
          ventanas clásicas de suscripción tardía y pestaña dormida.
          Filtros por fila (Fase 2): solo la entrega ACTIVA de este repartidor,
          no cada pedido del sistema. */}
      <RealtimeRefresh
        channelName="delivery-active-order"
        table="orders"
        event="*"
        filter={activeOrder ? `id=eq.${activeOrder.id}` : 'id=eq.00000000-0000-0000-0000-000000000000'}
        syncOnSubscribe
        refreshOnFocus
      />
      <RealtimeRefresh
        channelName="delivery-active-order-deliveries"
        table="deliveries"
        event="*"
        filter={activeOrder ? `order_id=eq.${activeOrder.id}` : 'order_id=eq.00000000-0000-0000-0000-000000000000'}
        syncOnSubscribe
        refreshOnFocus
      />

      {activeOrder ? (
        <DeliveryDetail orderId={activeOrder.id} />
      ) : (
        <EmptyState
          title="No tienes entrega activa"
          description="Ve a Disponibles para ofertar por un pedido."
          className="mt-6"
          action={
            <Button
              variant="lime"
              render={<Link href="/repartidor/disponibles" />}
              nativeButton={false}
            >
              Ver pedidos disponibles
            </Button>
          }
        />
      )}
    </PageContainer>
  )
}
