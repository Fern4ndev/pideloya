'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo } from 'react'
import useSWR from 'swr'
import { createClient } from '@/lib/db/client'
import { OrderStatusBadge } from '@/components/features/orders/OrderStatusBadge'
import { useRealtimeInvalidate } from '@/lib/hooks/use-realtime-invalidate'
import {
  ORDER_STATUS_GROUPS,
  type OrderStatusFilter,
} from '@/lib/constants/order-status'
import { cn } from '@/lib/utils'
import { ChevronRightIcon, ClockIcon, QrCodeIcon, ReceiptIcon } from 'lucide-react'
import { EmptyState } from '@/components/ui/empty-state'
import type { ApiOrder } from '@/types/order'

async function fetchOrders(url: string): Promise<{ success: true; data: ApiOrder[] }> {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${session?.access_token ?? ''}`,
    },
  })

  if (!res.ok) throw new Error('Error al cargar pedidos')
  return res.json()
}

const FILTER_CHIPS = [
  { key: null, label: 'Todos' },
  { key: 'active', label: 'Activos' },
  { key: 'delivered', label: 'Entregados' },
  { key: 'cancelled', label: 'Cancelados' },
] as const satisfies readonly { key: OrderStatusFilter | null; label: string }[]

const EMPTY_STATE_BY_FILTER: Record<
  OrderStatusFilter,
  { title: string; description: string }
> = {
  active: {
    title: 'No tienes pedidos activos',
    description: 'Cuando hagas un pedido, aparecerá aquí hasta que sea entregado.',
  },
  delivered: {
    title: 'Aún no tienes pedidos entregados',
    description: 'Tus pedidos completados aparecerán aquí.',
  },
  cancelled: {
    title: 'No tienes pedidos cancelados',
    description: 'Si cancelas algún pedido, aparecerá aquí.',
  },
}

function matchesFilter(orderStatus: string, filter: OrderStatusFilter) {
  return (ORDER_STATUS_GROUPS[filter] as readonly string[]).includes(orderStatus)
}

type OrdersListClientProps = {
  status?: OrderStatusFilter
}

export function OrdersListClient({ status }: OrdersListClientProps) {
  const router = useRouter()
  const activeFilter = status ?? null

  const { data, error, isLoading, mutate } = useSWR<{ success: true; data: ApiOrder[] }>(
    '/api/v1/orders',
    fetchOrders,
    { revalidateOnFocus: true }
  )

  useRealtimeInvalidate(
    { channelName: 'customer-orders', table: 'orders', event: '*' },
    () => mutate()
  )

  const orders = useMemo(() => data?.data ?? [], [data])
  const pendingCount = orders.filter((o) => o.status === 'PENDING').length
  // El pedido que espera la confirmación del pago es el único que necesita una
  // acción del cliente AHORA: por eso tiene su propio banner, más urgente que
  // el de "buscando repartidor" (que es espera pasiva). Si hubiera más de uno
  // —raro, pero posible con varios pedidos activos— se enlaza al primero: el
  // resto se ve en la lista de abajo.
  const awaitingPaymentOrder = orders.find((o) => o.status === 'AWAITING_PAYMENT')
  const showChips = isLoading || orders.length > 0

  const counts = useMemo(() => {
    const result: Record<OrderStatusFilter, number> = {
      active: 0,
      delivered: 0,
      cancelled: 0,
    }
    for (const order of orders) {
      for (const key of Object.keys(ORDER_STATUS_GROUPS) as OrderStatusFilter[]) {
        if (matchesFilter(order.status, key)) result[key] += 1
      }
    }
    return { all: orders.length, ...result }
  }, [orders])

  const filteredOrders = useMemo(
    () =>
      activeFilter
        ? orders.filter((o) => matchesFilter(o.status, activeFilter))
        : orders,
    [orders, activeFilter]
  )

  function setFilter(next: OrderStatusFilter | null) {
    router.replace(
      next ? `/cliente/pedidos?status=${next}` : '/cliente/pedidos',
      { scroll: false }
    )
  }

  return (
    <>
      {showChips && !error && (
        <section
          aria-label="Filtrar pedidos"
          className="-mx-1 mt-4 flex gap-2 overflow-x-auto px-1 pb-1"
        >
          {FILTER_CHIPS.map((chip) => {
            const isActive = activeFilter === chip.key
            return (
              <button
                key={chip.key ?? 'all'}
                type="button"
                onClick={() => setFilter(chip.key)}
                aria-pressed={isActive}
                className={cn(
                  'shrink-0 rounded-full border px-4 py-2.5 text-sm font-medium backdrop-blur transition-all duration-150 active:scale-95',
                  isActive
                    ? 'border-brand-500 bg-brand-500 text-white shadow-client-card'
                    : 'border-black/5 bg-white/70 text-muted-foreground hover:border-brand-300 hover:text-foreground dark:border-white/10 dark:bg-white/5'
                )}
              >
                {chip.label}
                {!isLoading && (
                  <span
                    className={cn(
                      'ml-1.5 inline-flex min-w-5 justify-center rounded-full px-1.5 py-px text-xs font-semibold tabular-nums',
                      isActive
                        ? 'bg-white/20 text-white'
                        : 'bg-black/5 text-muted-foreground dark:bg-white/10'
                    )}
                  >
                    {chip.key === null ? counts.all : counts[chip.key]}
                  </span>
                )}
              </button>
            )
          })}
        </section>
      )}

      {awaitingPaymentOrder && (!activeFilter || activeFilter === 'active') && (
        <Link
          href={`/cliente/pedidos/${awaitingPaymentOrder.id}`}
          className="mt-2 flex items-center gap-3 rounded-2xl border border-amber-300/60 bg-amber-50/80 px-4 py-3 backdrop-blur-sm transition-colors hover:bg-amber-100/80"
        >
          {/* amber-700 y no amber-600: sobre el fondo del banner el 600 da
              3.11:1 y este subtítulo es `text-xs` (texto chico normal →
              necesita 4.5:1). El 700 da 4.89:1 sobre el banner y 4.52:1 sobre
              el hover, y el mismo cambio aplica al ícono, que sobre el chip
              amber-100 pasaba de 2.87:1 a 4.52:1. */}
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
            <QrCodeIcon className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-medium text-amber-800">
              Tu repartidor ya está listo — confirma el pago del envío
            </p>
            <p className="text-xs text-amber-700">
              Toca aquí para ver el QR y confirmar
            </p>
          </div>
        </Link>
      )}

      {pendingCount > 0 && (!activeFilter || activeFilter === 'active') && (
        <div className="mt-2 flex items-center gap-3 rounded-2xl border border-amber-200/60 bg-amber-50/80 px-4 py-3 backdrop-blur-sm">
          {/* Mismo reloj con "tic" que la carta cerrada y el carrito con el
              negocio cerrado: un solo lenguaje visual para "esperando". */}
          {/* Mismo ajuste que el banner de arriba: el subtítulo estaba en
              amber-600 (3.11:1 sobre este fondo) teniendo el mismo problema de
              contraste. Se corrige acá también para que los dos banners,
              que se ven juntos, no queden con tonos distintos. */}
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
            <ClockIcon className="h-4 w-4 animate-clock-tick" />
          </span>
          <div>
            <p className="text-sm font-medium text-amber-800">
              {pendingCount} {pendingCount === 1 ? 'pedido buscando' : 'pedidos buscando'} repartidor
            </p>
            <p className="text-xs text-amber-700">
              Te avisaremos cuando un repartidor te ofrezca el envío
            </p>
          </div>
        </div>
      )}

      {error && (
        <p className="mt-6 rounded-2xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
          No se pudieron cargar tus pedidos.
        </p>
      )}

      {isLoading && (
        <div className="mt-6 space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-3xl bg-muted" />
          ))}
        </div>
      )}

      {!error && !isLoading && filteredOrders.length > 0 && (
        <div className="mt-6 space-y-3">
          {filteredOrders.map((order) => {
            const itemsSummary = order.order_items
              ?.map((i) => `${i.quantity}x ${i.product_name}`)
              .join(', ') ?? ''
            const previewItems = (order.order_items ?? []).slice(0, 3)
            return (
              <Link
                key={order.id}
                href={`/cliente/pedidos/${order.id}`}
                className="group block rounded-3xl border border-black/5 bg-white/70 p-4 shadow-client-card backdrop-blur-xl transition-all duration-300 ease-client hover:-translate-y-0.5 hover:shadow-client-card-hover dark:border-white/10 dark:bg-white/5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 gap-3">
                    {previewItems.length > 0 ? (
                      <div className="mt-0.5 flex shrink-0 -space-x-2.5">
                        {previewItems.map((item, i: number) => (
                          <div
                            key={i}
                            className="h-10 w-10 overflow-hidden rounded-2xl bg-muted shadow-sm ring-2 ring-white dark:ring-neutral-900"
                          >
                            {item.image_url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={item.image_url}
                                alt={item.product_name ?? ''}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-xs font-medium text-muted-foreground">
                                {item.product_name?.charAt(0) ?? '?'}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-brand-500/10 text-brand-600">
                        <ReceiptIcon className="h-5 w-5" />
                      </span>)}
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{itemsSummary}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {new Date(order.created_at).toLocaleDateString('es-PE', {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <div className="text-right">
                      <OrderStatusBadge status={order.status} />
                      <p className="mt-1 text-sm font-semibold">
                        S/ {Number(order.total).toFixed(2)}
                      </p>
                    </div>
                    <ChevronRightIcon className="h-4 w-4 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5" />
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}

      {!error && !isLoading && orders.length > 0 && filteredOrders.length === 0 && activeFilter && (
        <EmptyState
          icon={ReceiptIcon}
          title={EMPTY_STATE_BY_FILTER[activeFilter].title}
          description={EMPTY_STATE_BY_FILTER[activeFilter].description}
          className="mt-6 rounded-3xl border-black/10 bg-black/[0.02] dark:border-white/10 dark:bg-white/[0.02]"
        />
      )}

      {!error && !isLoading && orders.length === 0 && (
        <EmptyState
          icon={ReceiptIcon}
          title="Todavía no has hecho ningún pedido"
          description="Ve a un negocio y arma tu primer pedido."
          className="mt-10 rounded-3xl border-black/10 bg-black/[0.02] dark:border-white/10 dark:bg-white/[0.02]"
        />
      )}
    </>
  )
}
