'use client'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { EyeIcon, MapPinIcon, TagIcon, NavigationIcon } from 'lucide-react'

export interface AddressViewData {
  label: string | null
  addressText: string
  reference: string | null
  latitude: number
  longitude: number
}

export function AddressViewDialog({ address }: { address: AddressViewData }) {
  const mapUrl = `https://www.google.com/maps?q=${address.latitude},${address.longitude}`

  return (
    <Dialog>
      <DialogTrigger render={<Button variant="ghost" size="icon-sm" title="Ver dirección" />}>
        <EyeIcon className="h-4 w-4" />
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{address.label || 'Tu dirección de entrega'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex items-start gap-3 rounded-2xl bg-gradient-to-br from-brand-50 to-white p-4 ring-1 ring-black/5 dark:from-brand-950/30 dark:to-transparent dark:ring-white/10">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-500 text-white">
              <MapPinIcon className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              {address.label && (
                <p className="mb-0.5 flex items-center gap-1 text-xs font-medium text-brand-600">
                  <TagIcon className="h-3 w-3" />
                  {address.label}
                </p>
              )}
              <p className="text-sm font-medium leading-snug">{address.addressText}</p>
              {address.reference && (
                <p className="mt-1 text-xs text-muted-foreground">{address.reference}</p>
              )}
            </div>
          </div>

          <Button
            variant="outline"
            className="w-full gap-1.5 rounded-full"
            render={<a href={mapUrl} target="_blank" rel="noopener noreferrer" />}
            nativeButton={false}
          >
            <NavigationIcon className="h-3.5 w-3.5" />
            Ver en Google Maps
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}