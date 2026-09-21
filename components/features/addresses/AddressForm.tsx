'use client'

import { useState, useTransition, type SubmitEvent } from 'react'
import dynamic from 'next/dynamic'
import { createAddress, updateAddress } from '@/lib/actions/addresses'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { MapPinIcon, LocateFixedIcon } from 'lucide-react'

const AddressMapPicker = dynamic(() => import('./AddressMapPicker'), {
  ssr: false,
  loading: () => <div className="h-64 w-full animate-pulse rounded-2xl bg-muted" />,
})

export interface AddressFormValues {
  id?: string
  label: string
  addressText: string
  reference: string
  latitude: number | null
  longitude: number | null
}

export function AddressForm({
  initialData,
  onSaved,
}: {
  initialData?: AddressFormValues
  onSaved?: () => void
}) {
  const isEditing = Boolean(initialData?.id)
  const [label, setLabel] = useState(initialData?.label ?? '')
  const [addressText, setAddressText] = useState(initialData?.addressText ?? '')
  const [reference, setReference] = useState(initialData?.reference ?? '')
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    initialData?.latitude != null && initialData?.longitude != null
      ? { lat: initialData.latitude, lng: initialData.longitude }
      : null
  )
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleUseMyLocation() {
    if (!navigator.geolocation) {
      setError('Tu navegador no soporta geolocalización')
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
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
        const payload = {
          label: label || null,
          addressText,
          reference: reference || null,
          latitude: coords.lat,
          longitude: coords.lng,
        }
        if (isEditing && initialData?.id) {
          await updateAddress(initialData.id, payload)
        } else {
          await createAddress(payload)
        }
        onSaved?.()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Algo salió mal')
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="label">
          Nombre de la dirección{' '}
          <span className="font-normal text-muted-foreground">(opcional)</span>
        </Label>
        <Input
          id="label"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Casa, trabajo…"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="addressText">Dirección</Label>
        <Input
          id="addressText"
          value={addressText}
          onChange={(e) => setAddressText(e.target.value)}
          placeholder="Jr. Cusco 456"
          required
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="reference">
          Referencia{' '}
          <span className="font-normal text-muted-foreground">(opcional)</span>
        </Label>
        <Input
          id="reference"
          value={reference}
          onChange={(e) => setReference(e.target.value)}
          placeholder="Frente al mercado, portón verde…"
        />
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label className="flex items-center gap-1.5">
            <MapPinIcon className="h-3.5 w-3.5 text-brand-500" />
            Ubica el punto exacto
          </Label>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="gap-1.5"
            onClick={handleUseMyLocation}
          >
            <LocateFixedIcon className="h-3.5 w-3.5" />
            Usar mi ubicación
          </Button>
        </div>
        <div className="overflow-hidden rounded-2xl ring-1 ring-black/5 dark:ring-white/10">
          <AddressMapPicker
            latitude={coords?.lat ?? null}
            longitude={coords?.lng ?? null}
            onChange={(lat, lng) => setCoords({ lat, lng })}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Toca el mapa o arrastra el pin para ajustar la ubicación.
        </p>
      </div>

      {error && (
        <p className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <Button type="submit" className="w-full rounded-full" disabled={isPending}>
        {isPending ? 'Guardando…' : isEditing ? 'Guardar cambios' : 'Guardar dirección'}
      </Button>
    </form>
  )
}