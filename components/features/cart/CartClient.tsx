'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useCartStore, cartTotal } from '@/lib/hooks/use-cart'
import { createOrder } from '@/lib/actions/orders'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  MapPinIcon,
  MinusIcon,
  PlusIcon,
  Trash2Icon,
  ShoppingBagIcon,
  CheckCircle2Icon,
} from 'lucide-react'

export interface AddressOption {
  id: string
  label: string | null
  addressText: string
}

export function CartClient({ addresses }: { addresses: AddressOption[] }) {
  const router = useRouter()
  const { restaurantName, items, setQuantity, removeItem, clear } = useCartStore()
  const address = addresses[0] ?? null
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [orderPlaced, setOrderPlaced] = useState(false)
  const [isPending, startTransition] = useTransition()

  const total = cartTotal(items)

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
      <div className="flex flex-col items-center rounded-3xl border border-black/5 bg-white/70 p-10 text-center shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-green-500/10 text-green-600">
          <CheckCircle2Icon className="h-7 w-7" />
        </span>
        <p className="mt-4 text-lg font-semibold">¡Pedido realizado!</p>
        <p className="mt-1 max-w-xs text-sm text-muted-foreground">
          Tu pedido está esperando a que un repartidor lo acepte. Te avisaremos cuando esté en camino.
        </p>
        <Button className="mt-6 rounded-full" onClick={() => router.push('/cliente')}>
          Volver al inicio
        </Button>
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center rounded-3xl border border-dashed border-black/10 bg-black/[0.02] p-14 text-center dark:border-white/10 dark:bg-white/[0.02]">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-400 to-brand-600 text-white">
          <ShoppingBagIcon className="h-6 w-6" />
        </span>
        <p className="mt-4 font-medium">Tu carrito está vacío</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Ve a un negocio y agrega productos para empezar tu pedido.
        </p>
        <Button className="mt-6 rounded-full" render={<Link href="/cliente" />} nativeButton={false}>
          Ver negocios
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-sm font-medium text-muted-foreground">Pedido de {restaurantName}</h2>
        <div className="mt-3 space-y-3">
          {items.map((item) => (
            <div
              key={item.productId}
              className="flex items-center gap-3 rounded-2xl border border-black/5 bg-white/70 p-3.5 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-white/5"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{item.name}</p>
                <p className="text-sm text-muted-foreground">S/ {item.price.toFixed(2)}</p>
              </div>
              <div className="flex items-center gap-1.5 rounded-full bg-black/[0.03] p-1 dark:bg-white/5">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="rounded-full"
                  onClick={() => setQuantity(item.productId, item.quantity - 1)}
                >
                  <MinusIcon className="h-3.5 w-3.5" />
                </Button>
                <span className="w-5 text-center text-sm font-medium">{item.quantity}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="rounded-full"
                  onClick={() => setQuantity(item.productId, item.quantity + 1)}
                >
                  <PlusIcon className="h-3.5 w-3.5" />
                </Button>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="text-destructive hover:text-destructive"
                onClick={() => removeItem(item.productId)}
              >
                <Trash2Icon className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <p className="text-sm font-medium">Dirección de entrega</p>
        {address ? (
          <div className="flex items-center gap-3 rounded-2xl border border-black/5 bg-white/70 p-3.5 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-500/10 text-brand-600">
              <MapPinIcon className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              {address.label && <p className="text-xs font-medium text-brand-600">{address.label}</p>}
              <p className="truncate text-sm">{address.addressText}</p>
            </div>
            <Link href="/cliente/direcciones" className="shrink-0 text-xs font-medium text-brand-600 hover:underline">
              Cambiar
            </Link>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-black/10 bg-black/[0.02] p-4 text-sm dark:border-white/10 dark:bg-white/[0.02]">
            No tienes una dirección guardada.{' '}
            <Link href="/cliente/direcciones" className="font-medium text-brand-600 underline underline-offset-2">
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

      <div className="flex items-center justify-between rounded-2xl bg-brand-500/5 px-4 py-3.5">
        <span className="text-sm text-muted-foreground">Total</span>
        <span className="text-lg font-semibold text-brand-700">S/ {total.toFixed(2)}</span>
      </div>

      {error && (
        <p className="rounded-2xl bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</p>
      )}

      <Button className="w-full rounded-full" disabled={isPending || !address} onClick={handleConfirm}>
        {isPending ? 'Enviando pedido…' : 'Confirmar pedido'}
      </Button>
    </div>
  )
}