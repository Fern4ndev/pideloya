'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useCartStore, cartTotal } from '@/lib/hooks/use-cart'
import { createOrder } from '@/lib/actions/orders'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export interface AddressOption {
  id: string
  label: string | null
  addressText: string
}

export function CartClient({ addresses }: { addresses: AddressOption[] }) {
  const router = useRouter()
  const { restaurantName, items, setQuantity, removeItem, clear } =
    useCartStore()
  const [addressId, setAddressId] = useState(addresses[0]?.id ?? '')
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
    if (!addressId) {
      setError('Elige una dirección de entrega')
      return
    }

    startTransition(async () => {
      try {
        await createOrder({
          addressId,
          notes,
          items: items.map((i) => ({
            productId: i.productId,
            quantity: i.quantity,
          })),
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
      <div className="rounded-xl border bg-muted/40 p-8 text-center">
        <p className="text-lg font-medium">¡Pedido realizado!</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Tu pedido está esperando a que un repartidor lo acepte. Te
          avisaremos cuando esté en camino.
        </p>
        <Button className="mt-6" onClick={() => router.push('/cliente')}>
          Volver al inicio
        </Button>
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed p-14 text-center">
        <p className="font-medium">Tu carrito está vacío</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Ve a un negocio y agrega productos para empezar tu pedido.
        </p>
        <Button className="mt-6" render={<Link href="/cliente" />} nativeButton={false}>
          Ver negocios
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-sm font-medium text-muted-foreground">
          Pedido de {restaurantName}
        </h2>
        <div className="mt-3 space-y-3">
          {items.map((item) => (
            <div
              key={item.productId}
              className="flex items-center gap-3 rounded-xl border p-3"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{item.name}</p>
                <p className="text-sm text-muted-foreground">
                  S/ {item.price.toFixed(2)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setQuantity(item.productId, item.quantity - 1)
                  }
                >
                  −
                </Button>
                <span className="w-6 text-center text-sm">
                  {item.quantity}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setQuantity(item.productId, item.quantity + 1)
                  }
                >
                  +
                </Button>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={() => removeItem(item.productId)}
              >
                Quitar
              </Button>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-1">
        <p className="text-sm font-medium">Dirección de entrega</p>
        {addresses.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No tienes direcciones guardadas.{' '}
            <Link href="/cliente/direcciones" className="underline">
              Agrega una
            </Link>{' '}
            para poder continuar.
          </p>
        ) : (
          <Select value={addressId} onValueChange={(v) => setAddressId(v ?? '')}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Elige una dirección" />
            </SelectTrigger>
            <SelectContent>
              {addresses.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.label ? `${a.label} — ` : ''}
                  {a.addressText}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <div className="space-y-1">
        <p className="text-sm font-medium">
          Notas para el pedido{' '}
          <span className="font-normal text-muted-foreground">
            (opcional)
          </span>
        </p>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Sin cebolla, tocar el timbre 2 veces…"
          rows={2}
        />
      </div>

      <div className="flex items-center justify-between border-t pt-4">
        <span className="text-sm text-muted-foreground">Total</span>
        <span className="text-lg font-semibold">S/ {total.toFixed(2)}</span>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button
        className="w-full"
        disabled={isPending || addresses.length === 0}
        onClick={handleConfirm}
      >
        {isPending ? 'Enviando pedido…' : 'Confirmar pedido'}
      </Button>
    </div>
  )
}