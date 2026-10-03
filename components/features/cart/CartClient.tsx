'use client'

import { useState, useTransition, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useCartStore, cartTotal } from '@/lib/hooks/use-cart'
import { createOrder, getRestaurantCheckoutState } from '@/lib/actions/orders'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { EmptyState } from '@/components/ui/empty-state'
import {
  MapPinIcon,
  MinusIcon,
  PlusIcon,
  Trash2Icon,
  ShoppingCartIcon,
  CheckCircle2Icon,
  ClockIcon,
} from 'lucide-react'

export interface AddressOption {
  id: string
  label: string | null
  addressText: string
}

export function CartClient({ addresses }: { addresses: AddressOption[] }) {
  const router = useRouter()
  const { restaurantId, restaurantName, items, setQuantity, removeItem, clear } = useCartStore()
  const address = addresses[0] ?? null
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [orderPlaced, setOrderPlaced] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [openState, setOpenState] = useState<{ id: string; isOpen: boolean } | null>(null)

  const total = cartTotal(items)

  // Consulta si el negocio está atendiendo ahora mismo (source of truth en
  // el servidor al confirmar; aquí solo para avisar y deshabilitar la UI).
  useEffect(() => {
    if (!restaurantId) return
    let cancelled = false
    getRestaurantCheckoutState(restaurantId).then((res) => {
      if (!cancelled) setOpenState({ id: restaurantId, isOpen: res.isOpenNow })
    })
    return () => {
      cancelled = true
    }
  }, [restaurantId])

  // stale guard: si cambió el restaurante, el resultado viejo no aplica
  const isRestaurantClosed = openState?.id === restaurantId && !openState.isOpen

  function handleConfirm() {
    setError(null)
    if (items.length === 0) {
      setError('Tu carrito está vacío')
      return
    }
    if (!address) {
      setError('Agrega una dirección de entrega para continuar')
      return
    }
    if (isRestaurantClosed) {
      setError('El negocio está cerrado en este momento. No se pueden recibir pedidos.')
      return
    }

    startTransition(async () => {
      try {
        await createOrder({
          addressId: address.id,
          notes,
          items: items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
        })
        clear()
        setOrderPlaced(true)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Algo salió mal')
      }
    })
  }

  if (orderPlaced) {
    return (
      <div className="flex flex-col items-center rounded-3xl border border-black/5 bg-white/70 p-10 text-center shadow-client-card backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
        {/* El "momento de éxito" usa el acento de deleite de la marca (lima)
            en vez del verde genérico del sistema operativo. */}
        <span className="flex h-14 w-14 animate-fade-up items-center justify-center rounded-full bg-lime/15 text-[#0C0C0E]">
          <CheckCircle2Icon className="h-7 w-7" />
        </span>
        <p className="mt-4 text-lg font-semibold">¡Pedido realizado!</p>
        <p className="mt-1 max-w-xs text-sm text-muted-foreground">
          Tu pedido está esperando a que un repartidor lo acepte. Te avisaremos cuando esté en camino.
        </p>
        <Button className="mt-6 rounded-full" onClick={() => router.push('/cliente/pedidos?status=active')}>
          Ver mis pedidos
        </Button>
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <EmptyState
        icon={ShoppingCartIcon}
        title="Tu carrito está vacío"
        description="Ve a un negocio y agrega productos para empezar tu pedido."
        className="rounded-3xl border-black/10 bg-black/[0.02] py-14 dark:border-white/10 dark:bg-white/[0.02]"
        action={
          <Button className="rounded-full" render={<Link href="/cliente" />} nativeButton={false}>
            Ver negocios
          </Button>
        }
      />
    )
  }

  return (
    <div className="space-y-6">
      {isRestaurantClosed && (
        <div className="flex items-center gap-2 rounded-2xl border border-amber-300/60 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
          <ClockIcon className="h-4 w-4 shrink-0 animate-clock-tick" />
          <span>
            El negocio está cerrado en este momento. Puedes dejar tu pedido
            guardado y confirmarlo cuando vuelva a atender.
          </span>
        </div>
      )}

      {/* En desktop el contenido se parte en 2 columnas 50/50: productos a la
          izquierda y el resumen (dirección, notas, total) a la derecha, para
          que nada se estire al ancho completo del `max-w-5xl` del layout. En
          móvil todo sigue apilado en una sola columna. */}
      <div className="grid gap-6 md:grid-cols-2 md:items-start">
        <div>
          <h2 className="text-sm font-medium text-muted-foreground">
            Pedido de {restaurantName}
          </h2>
          <div className="mt-3 space-y-3">
            {items.map((item) => (
              <div
                key={item.productId}
                className="flex items-center gap-3 rounded-3xl border border-black/5 bg-white/70 p-3.5 shadow-client-card backdrop-blur-xl dark:border-white/10 dark:bg-white/5"
              >
                <div className="h-10 w-10 shrink-0 overflow-hidden rounded-2xl bg-muted shadow-sm">
                  {item.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.imageUrl}
                      alt={item.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs font-medium text-muted-foreground">
                      {item.name.charAt(0) ?? '?'}
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{item.name}</p>
                  <p className="text-sm text-muted-foreground">S/ {item.price.toFixed(2)}</p>
                </div>
                {/* Stepper y papelera a 40×40px de objetivo táctil (el control
                    es un icono, el área real es el botón). */}
                <div className="flex items-center gap-1 rounded-full bg-black/[0.03] p-1 dark:bg-white/5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="h-10 w-10 rounded-full"
                    onClick={() => setQuantity(item.productId, item.quantity - 1)}
                    aria-label={`Quitar una unidad de ${item.name}`}
                  >
                    <MinusIcon className="h-3.5 w-3.5" />
                  </Button>
                  <span className="w-5 text-center text-sm font-medium tabular-nums">
                    {item.quantity}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="h-10 w-10 rounded-full"
                    onClick={() => setQuantity(item.productId, item.quantity + 1)}
                    aria-label={`Agregar una unidad de ${item.name}`}
                  >
                    <PlusIcon className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="h-10 w-10 text-destructive hover:text-destructive"
                  onClick={() => removeItem(item.productId)}
                  aria-label={`Quitar ${item.name} del carrito`}
                >
                  <Trash2Icon className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          <div className="space-y-1.5">
            <p className="text-sm font-medium">Dirección de entrega</p>
            {address ? (
              <div className="flex items-center gap-3 rounded-3xl border border-black/5 bg-white/70 p-3.5 shadow-client-card backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-500/10 text-brand-600">
                  <MapPinIcon className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  {address.label && (
                    <p className="text-xs font-medium text-brand-700">{address.label}</p>
                  )}
                  <p className="truncate text-sm">{address.addressText}</p>
                </div>
                <Link
                  href="/cliente/direcciones"
                  className="shrink-0 text-xs font-medium text-brand-700 hover:underline"
                >
                  Cambiar
                </Link>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-black/10 bg-black/[0.02] p-4 text-sm dark:border-white/10 dark:bg-white/[0.02]">
                No tienes una dirección guardada.{' '}
                <Link
                  href="/cliente/direcciones"
                  className="font-medium text-brand-700 underline underline-offset-2"
                >
                  Agrega una
                </Link>{' '}
                para poder continuar.
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <p className="text-sm font-medium">
              Notas para el pedido{' '}
              <span className="font-normal text-muted-foreground">(opcional)</span>
            </p>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Sin cebolla, tocar el timbre 2 veces…"
              rows={2}
              className="rounded-2xl"
            />
          </div>
        </div>

        {/* Total + CTA anclados al borde inferior mientras se revisa el pedido:
            el cliente nunca pierde de vista cuánto va a pagar. Vive como hijo
            directo del grid (no de la columna derecha) para que su contenedor
            `sticky` sea el grid completo: si estuviera dentro de la columna,
            su alto sería solo el suyo y el anclado no tendría recorrido.
            `md:col-start-2` lo ubica bajo la columna de resumen en desktop. */}
        <div className="sticky bottom-4 z-10 space-y-3 md:col-start-2">
          <div className="flex items-center justify-between rounded-3xl bg-brand-500/5 px-4 py-3.5 shadow-client-floating backdrop-blur-xl">
            <span className="text-sm text-muted-foreground">Total</span>
            <span className="text-lg font-semibold text-brand-700">S/ {total.toFixed(2)}</span>
          </div>

          {error && (
            <p className="rounded-2xl bg-destructive/10 px-4 py-3 text-sm text-destructive backdrop-blur-xl">
              {error}
            </p>
          )}

          <Button
            className="w-full rounded-full"
            disabled={isPending || !address || isRestaurantClosed}
            onClick={handleConfirm}
          >
            {isPending ? 'Enviando pedido…' : 'Confirmar pedido'}
          </Button>
        </div>
      </div>
    </div>
  )
}