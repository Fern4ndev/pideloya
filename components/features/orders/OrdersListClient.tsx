'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'
import useSWRInfinite from 'swr/infinite'
import { createClient } from '@/lib/db/client'
import { OrderStatusBadge } from '@/components/features/orders/OrderStatusBadge'
import { useRealtimeInvalidate } from '@/lib/hooks/use-realtime-invalidate'
import {
  ORDER_STATUS_GROUPS,
  type OrderStatusFilter,
} from '@/lib/constants/order-status'
import { cancelOrder } from '@/lib/actions/orders'
import { addDays, dayParts, limaDayKey, MONTHS_FULL } from '@/lib/dates'
import { withImageKitTransform } from '@/lib/images/imagekit-transform'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  CheckCircle2,
  ChevronRightIcon,
  Clock3Icon,
  QrCodeIcon,
  ReceiptIcon,
} from 'lucide-react'
import { EmptyState } from '@/components/ui/empty-state'
import type { ApiOrder, ApiOrdersMeta } from '@/types/order'

const PAGE_SIZE = 15
const DELIVERY_SEARCH_TIMEOUT_MS = 5 * 60 * 1000

type OrdersPage = { success: true; data: ApiOrder[]; meta?: ApiOrdersMeta }

async function fetchOrders(url: string): Promise<OrdersPage> {
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
  { key: 'active', label: 'Activos' },
  { key: null, label: 'Todos' },
  { key: 'delivered', label: 'Entregados' },
  { key: 'cancelled', label: 'Cancelados' },
] as const satisfies readonly { key: OrderStatusFilter | null; label: string }[]

function formatRemainingDeliveryWindow(ms: number) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

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
  /** profileId del cliente (resuelto en el servidor con la sesión): filtra el
   *  canal de realtime por SU propietario. Sin filtro, cada cliente recibía
   *  eventos de TODOS los pedidos del sistema (RLS de realtime no filtra
   *  postgres_changes por fila sin filtro explícito) y cada cambio ajeno
   *  disparaba un refetch del listado completo. */
  profileId: string
}

export function OrdersListClient({ status, profileId }: OrdersListClientProps) {
  const router = useRouter()
  const activeFilter = status ?? null
  const [now, setNow] = useState(() => Date.now())
  const [acceptedOrderId, setAcceptedOrderId] = useState<string | null>(null)
  const autoCancelOrderIdsRef = useRef<Set<string>>(new Set())
  const seenPendingOrderIdsRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    const intervalId = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(intervalId)
  }, [])

  const {
    data,
    error,
    isLoading,
    isValidating,
    size,
    setSize,
    mutate,
  } = useSWRInfinite<OrdersPage>(
    (pageIndex, prevPage) => {
      // Una página corta significa que no quedan más pedidos: corta la serie.
      if (pageIndex > 0 && prevPage && prevPage.data.length < PAGE_SIZE) return null
      const params = new URLSearchParams({
        offset: String(pageIndex * PAGE_SIZE),
        limit: String(PAGE_SIZE),
      })
      if (status) params.set('status', status)
      return `/api/v1/orders?${params}`
    },
    fetchOrders,
    {
      // Fase 2 (anti-churn): el foco de la pestaña ya NO dispara consulta —
      // el realtime filtrado de abajo invalida cuando algo REAL cambia.
      revalidateOnFocus: false,
    }
  )

  useRealtimeInvalidate(
    {
      channelName: 'customer-orders',
      table: 'orders',
      event: '*',
      filter: `customer_id=eq.${profileId}`,
    },
    () => mutate()
  )

  const orders = useMemo(() => data?.flatMap((page) => page.data) ?? [], [data])
  // La meta viene en la primera página (misma serie, mismo filtro).
  const meta = data?.[0]?.meta
  const counts = meta?.counts
  const totalOrders = counts?.all ?? orders.length
  // Fallback al array cargado mientras cambia el filtro (meta aún no llega).
  const pendingCount =
    counts?.pending ?? orders.filter((o) => o.status === 'PENDING').length
  // El pedido que espera la confirmación del pago es el único que necesita una
  // acción del cliente AHORA: por eso tiene su propio banner, más urgente que
  // el de "buscando repartidor" (que es espera pasiva). Si hubiera más de uno
  // —raro, pero posible con varios pedidos activos— se enlaza al primero: el
  // resto se ve en la lista de abajo. La página 1 siempre está cargada y ese
  // pedido es reciente, así que encontrarlo sobre lo acumulado alcanza.
  const awaitingPaymentOrder = orders.find((o) => o.status === 'AWAITING_PAYMENT')
  // `totalOrders` (global) y no `orders.length`: con un filtro sin resultados
  // la página viene vacía y los chips deben seguir visibles para poder
  // volver a "Todos".
  const showChips = isLoading || totalOrders > 0

  const isFetchingMore = isValidating && size > (data?.length ?? 0)
  const lastPage = data?.[data.length - 1]
  const hasMore = !!lastPage && lastPage.data.length === PAGE_SIZE

  // Sentinel: precarga la siguiente página al acercarse al final. Se reconstruye
  // al terminar cada carga (isValidating) para que, si sigue en pantalla, siga
  // cargando; con el observer vivo mientras valida no se disparan pedidos dobles.
  const sentinelRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    const el = sentinelRef.current
    if (!el || !hasMore || isValidating) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) setSize((s) => s + 1)
      },
      { rootMargin: '300px 0px' }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [hasMore, isValidating, setSize])

  const filteredOrders = useMemo(
    () =>
      activeFilter
        ? orders.filter((o) => matchesFilter(o.status, activeFilter))
        : orders,
    [orders, activeFilter]
  )

  const pendingSearchOrders = useMemo(
    () => orders.filter((order) => order.status === 'PENDING'),
    [orders]
  )

  const activePendingOrder = pendingSearchOrders[0] ?? null
  const activePendingDeadline = activePendingOrder
    ? new Date(activePendingOrder.created_at).getTime() + DELIVERY_SEARCH_TIMEOUT_MS
    : null
  const activePendingRemainingMs = activePendingDeadline
    ? Math.max(0, activePendingDeadline - now)
    : null

  useEffect(() => {
    for (const order of pendingSearchOrders) {
      const expiresAt = new Date(order.created_at).getTime() + DELIVERY_SEARCH_TIMEOUT_MS
      if (now >= expiresAt && !autoCancelOrderIdsRef.current.has(order.id)) {
        autoCancelOrderIdsRef.current.add(order.id)
        void cancelOrder(order.id).catch(() => {
          autoCancelOrderIdsRef.current.delete(order.id)
        })
      }
    }
  }, [now, pendingSearchOrders])

  useEffect(() => {
    const pendingIds = new Set(pendingSearchOrders.map((order) => order.id))
    const newlyAccepted = orders.filter(
      (order) =>
        order.status !== 'PENDING' &&
        order.status !== 'CANCELLED' &&
        seenPendingOrderIdsRef.current.has(order.id)
    )

    if (newlyAccepted.length > 0) {
      const acceptedOrder = newlyAccepted[0]
      setAcceptedOrderId(acceptedOrder.id)
      const redirectTimer = window.setTimeout(() => {
        router.push(`/cliente/pedidos/${acceptedOrder.id}`)
      }, 1800)

      return () => window.clearTimeout(redirectTimer)
    }

    seenPendingOrderIdsRef.current = pendingIds
  }, [orders, pendingSearchOrders, router])

  // Agrupa por día de Lima preservando el orden desc de la API. Corre solo con
  // datos ya llegados (el SSR renderiza el skeleton), así que no hay riesgo de
  // hydration mismatch por calcular "hoy" en el cliente.
  const orderGroups = useMemo(() => {
    const groups: { key: string; orders: ApiOrder[] }[] = []
    for (const order of filteredOrders) {
      const key = limaDayKey(new Date(order.created_at))
      const last = groups[groups.length - 1]
      if (last && last.key === key) last.orders.push(order)
      else groups.push({ key, orders: [order] })
    }
    return groups
  }, [filteredOrders])

  const todayKey = limaDayKey(new Date())
  const yesterdayKey = addDays(todayKey, -1)

  function groupLabel(key: string) {
    if (key === todayKey) return 'Hoy'
    if (key === yesterdayKey) return 'Ayer'
    const { day, month } = dayParts(key)
    return `${day} de ${MONTHS_FULL[month - 1]} de ${key.slice(0, 4)}`
  }

  function setFilter(next: OrderStatusFilter | null) {
    router.replace(
      next ? `/cliente/pedidos?status=${next}` : '/cliente/pedidos',
      { scroll: false }
    )
  }

  return (
    <>
      <Dialog
        open={Boolean(acceptedOrderId)}
        onOpenChange={(isOpen) => {
          if (!isOpen) setAcceptedOrderId(null)
        }}
      >
        <DialogContent className="sm:max-w-md border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-emerald-100/80 dark:border-emerald-900/60 dark:from-emerald-950 dark:via-neutral-950 dark:to-emerald-950/80">
          <div className="flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 shadow-sm shadow-emerald-200/60 dark:bg-emerald-500/10 dark:text-emerald-300">
              <CheckCircle2 className="h-8 w-8" />
            </div>
          </div>
          <DialogHeader className="text-center">
            <DialogTitle className="text-2xl font-semibold text-emerald-900 dark:text-emerald-100">
              Tu pedido fue aceptado
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              Un repartidor ya tomó tu pedido. Te estamos llevando al detalle para que sigas el progreso en tiempo real.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-100">
            Redirigiendo al pedido en <span className="font-semibold">2 segundos</span>
          </div>

          <DialogFooter className="sm:justify-center">
            <Button
              type="button"
              className="rounded-full bg-emerald-600 text-white hover:bg-emerald-700"
              onClick={() => {
                if (acceptedOrderId) {
                  router.push(`/cliente/pedidos/${acceptedOrderId}`)
                }
              }}
            >
              Ver pedido
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
                {!isLoading && counts && (
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
              3.11:1, por debajo del 4.5:1 que necesita el texto. El 700 da
              4.89:1 sobre el banner y 4.52:1 sobre el hover, y el mismo cambio
              aplica al ícono, que sobre el chip amber-100 pasaba de 2.87:1 a
              4.52:1. */}
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
            <QrCodeIcon className="h-4 w-4" />
          </span>
          {/* Una sola línea: el subtítulo ("Toca aquí para elegir cómo pagar")
              repetía palabra por palabra lo que ya dice el título. */}
          <p className="min-w-0 text-sm font-medium text-amber-800">
            Tu repartidor ya está listo — elige cómo pagar el envío
          </p>
        </Link>
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

      {!error && !isLoading && orderGroups.length > 0 && (
        <div className="mt-6 space-y-5">
          {orderGroups.map((group) => (
            <section key={group.key} aria-label={groupLabel(group.key)}>
              <h3 className="mb-2 text-sm font-medium text-muted-foreground">
                {groupLabel(group.key)}
              </h3>
              <div className="space-y-3">
                {group.orders.map((order) => {
                  const itemsSummary = order.order_items
                    ?.map((i) => `${i.quantity}x ${i.product_name}`)
                    .join(', ') ?? ''
                  const previewItems = (order.order_items ?? []).slice(0, 3)
                  const remainingMs =
                    order.status === 'PENDING'
                      ? Math.max(
                          0,
                          new Date(order.created_at).getTime() + DELIVERY_SEARCH_TIMEOUT_MS - now,
                        )
                      : null

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
                                      src={withImageKitTransform(item.image_url, 160)}
                                      alt={item.product_name ?? ''}
                                      className="h-full w-full object-cover"
                                      loading="lazy"
                                      decoding="async"
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
                            <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                              <span>
                                {new Date(order.created_at).toLocaleTimeString('es-PE', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                              {remainingMs !== null && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 font-medium text-amber-700 dark:bg-amber-500/10 dark:text-amber-200">
                                  <Clock3Icon className="h-3 w-3" />
                                  {formatRemainingDeliveryWindow(remainingMs)}
                                </span>
                              )}
                            </div>
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
            </section>
          ))}
        </div>
      )}

      {hasMore && <div ref={sentinelRef} className="h-px" aria-hidden="true" />}

      {!error && !isLoading && hasMore && (
        <div className="mt-5 flex justify-center">
          <Button
            type="button"
            variant="outline"
            className="rounded-full px-6"
            disabled={isFetchingMore}
            onClick={() => setSize(size + 1)}
          >
            {isFetchingMore ? 'Cargando…' : 'Cargar más'}
          </Button>
        </div>
      )}

      {!error && !isLoading && totalOrders > 0 && filteredOrders.length === 0 && activeFilter && (
        <EmptyState
          icon={ReceiptIcon}
          title={EMPTY_STATE_BY_FILTER[activeFilter].title}
          description={EMPTY_STATE_BY_FILTER[activeFilter].description}
          className="mt-6 rounded-3xl border-black/10 bg-black/[0.02] dark:border-white/10 dark:bg-white/[0.02]"
        />
      )}

      {!error && !isLoading && totalOrders === 0 && (
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
