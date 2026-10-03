import { OrdersListClient } from '@/components/features/orders/OrdersListClient'
import { ClientPageContainer } from '@/components/layout/ClientPageContainer'
import type { OrderStatusFilter } from '@/lib/constants/order-status'

type OrdersPageProps = {
  searchParams: Promise<{ status?: string }>
}

const VALID_FILTERS: OrderStatusFilter[] = ['active', 'delivered', 'cancelled']

export default async function OrdersPage({ searchParams }: OrdersPageProps) {
  const { status } = await searchParams
  const filter = VALID_FILTERS.includes(status as OrderStatusFilter)
    ? (status as OrderStatusFilter)
    : undefined

  return (
    <ClientPageContainer size="wide">
      <h1 className="text-2xl font-semibold tracking-tight">Mis pedidos</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        El historial y estado de todo lo que has pedido.
      </p>
      <OrdersListClient status={filter} />
    </ClientPageContainer>
  )
}
