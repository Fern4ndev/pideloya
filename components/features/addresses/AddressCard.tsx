import { MapPinIcon, TagIcon } from 'lucide-react'
import { AddressFormDialog } from './AddressFormDialog'
import { AddressViewDialog } from './AddressViewDialog'

export interface AddressCardData {
  id: string
  label: string | null
  address_text: string
  reference: string | null
  latitude: number
  longitude: number
}

export function AddressCard({ address }: { address: AddressCardData }) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-3xl border border-black/5 bg-white/70 p-5 shadow-client-card backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
      <div className="flex min-w-0 items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-400 to-brand-600 text-white shadow-sm shadow-brand-500/30">
          <MapPinIcon className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          {/* brand-700 y no brand-600: a 12px el 600 queda en ~3.5:1 sobre
              blanco, por debajo del 4.5:1 que exige el texto pequeño. */}
          {address.label && (
            <p className="mb-0.5 flex items-center gap-1 text-xs font-medium text-brand-700">
              <TagIcon className="h-3 w-3" />
              {address.label}
            </p>
          )}
          <p className="truncate text-sm font-medium">{address.address_text}</p>
          {address.reference && (
            <p className="mt-0.5 truncate text-xs text-muted-foreground">{address.reference}</p>
          )}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-0.5">
        <AddressViewDialog
          address={{
            label: address.label,
            addressText: address.address_text,
            reference: address.reference,
            latitude: address.latitude,
            longitude: address.longitude,
          }}
        />
        <AddressFormDialog
          mode="edit"
          initialData={{
            id: address.id,
            label: address.label ?? '',
            addressText: address.address_text,
            reference: address.reference ?? '',
            latitude: address.latitude,
            longitude: address.longitude,
          }}
        />
      </div>
    </div>
  )
}