import { OrdersListClient } from '@/components/features/orders/OrdersListClient'

export default function OrdersPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Mis pedidos</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        El historial y estado de todo lo que has pedido.
      </p>
      <OrdersListClient />
    </div>
  )
}
