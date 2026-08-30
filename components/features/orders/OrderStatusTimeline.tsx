import {
  ORDER_STATUS_STEPS,
  ORDER_STATUS_LABELS,
  type OrderStatus,
} from '@/lib/constants/order-status'

export function OrderStatusTimeline({ status }: { status: OrderStatus }) {
  if (status === 'CANCELLED') {
    return (
      <p className="text-sm font-medium text-destructive">
        Este pedido fue cancelado.
      </p>
    )
  }

  const currentIndex = ORDER_STATUS_STEPS.indexOf(
    status as (typeof ORDER_STATUS_STEPS)[number]
  )

  return (
    <ol className="space-y-3">
      {ORDER_STATUS_STEPS.map((step, index) => {
        const done = index <= currentIndex
        return (
          <li key={step} className="flex items-center gap-3">
            <span
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-medium ${
                done
                  ? 'bg-foreground text-background'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              {index + 1}
            </span>
            <span
              className={
                done
                  ? 'text-sm font-medium'
                  : 'text-sm text-muted-foreground'
              }
            >
              {ORDER_STATUS_LABELS[step]}
            </span>
          </li>
        )
      })}
    </ol>
  )
}