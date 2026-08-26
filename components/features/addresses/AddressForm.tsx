'use client'

import { useState, useTransition, type SubmitEvent } from 'react'
import dynamic from 'next/dynamic'
import { createAddress } from '@/lib/actions/addresses'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

// ssr: false es obligatorio — Leaflet usa `window` y `document`
// directamente, y se rompe si Next.js intenta renderizarlo en servidor.
const AddressMapPicker = dynamic(() => import('./AddressMapPicker'), {
  ssr: false,
  loading: () => (
    <div className="h-64 w-full animate-pulse rounded-lg bg-muted" />
  ),
})

export function AddressForm({ onCreated }: { onCreated?: () => void }) {
  const [label, setLabel] = useState('')
  const [addressText, setAddressText] = useState('')
  const [reference, setReference] = useState('')
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    null
  )
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleUseMyLocation() {
    if (!navigator.geolocation) {
      setError('Tu navegador no soporta geolocalización')
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () =>
        setError(
          'No pudimos obtener tu ubicación. Ubica el pin manualmente en el mapa.'
        )
    )
  }

  function handleSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    if (!coords) {
      setError('Toca el mapa para ubicar tu dirección exacta')
      return
    }

    startTransition(async () => {
      try {
        await createAddress({
          label: label || null,
          addressText,
          reference: reference || null,
          latitude: coords.lat,
          longitude: coords.lng,
        })
        setLabel('')
        setAddressText('')
        setReference('')
        setCoords(null)
        onCreated?.()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Algo salió mal')
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="space-y-1">
        <Label htmlFor="label">
          Nombre de la dirección{' '}
          <span className="font-normal text-muted-foreground">
            (opcional)
          </span>
        </Label>
        <Input
          id="label"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Casa, trabajo…"
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor="addressText">Dirección</Label>
        <Input
          id="addressText"
          value={addressText}
          onChange={(e) => setAddressText(e.target.value)}
          placeholder="Jr. Cusco 456"
          required
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor="reference">
          Referencia{' '}
          <span className="font-normal text-muted-foreground">
            (opcional)
          </span>
        </Label>
        <Input
          id="reference"
          value={reference}
          onChange={(e) => setReference(e.target.value)}
          placeholder="Frente al mercado, portón verde…"
        />
      </div>

      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <Label>Ubica el punto exacto en el mapa</Label>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={handleUseMyLocation}
          >
            Usar mi ubicación
          </Button>
        </div>
        <AddressMapPicker
          latitude={coords?.lat ?? null}
          longitude={coords?.lng ?? null}
          onChange={(lat, lng) => setCoords({ lat, lng })}
        />
        <p className="text-xs text-muted-foreground">
          Toca el mapa o arrastra el pin para ajustar la ubicación.
        </p>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? 'Guardando…' : 'Guardar dirección'}
      </Button>
    </form>
  )
}