import { createClient } from '@/lib/db/server'
import { AddressFormDialog } from '@/components/features/addresses/AddressFormDialog'
import { AddressCard } from '@/components/features/addresses/AddressCard'
import { MapPinIcon } from 'lucide-react'

export default async function AddressesPage() {
  const supabase = await createClient()

  // Regla de negocio: cada cliente guarda como máximo UNA dirección
  // (ver constraint `addresses_one_per_customer`).
  const { data: addresses, error } = await supabase
    .from('addresses')
    .select('id, label, address_text, reference, latitude, longitude')
    .order('created_at', { ascending: false })
    .limit(1)

  const address = addresses?.[0] ?? null

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Tu dirección</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            La usamos para saber a dónde llevar tu pedido.
          </p>
        </div>
        {!address && !error && <AddressFormDialog mode="create" />}
      </div>

      {error && (
        <p className="mt-6 rounded-2xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
          No se pudo cargar tu dirección.
        </p>
      )}

      {!error && address && (
        <div className="mt-6">
          <AddressCard address={address} />
        </div>
      )}

      {!error && !address && (
        <div className="mt-10 flex flex-col items-center rounded-3xl border border-dashed border-black/10 bg-black/[0.02] px-6 py-14 text-center dark:border-white/10 dark:bg-white/[0.02]">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-400 to-brand-600 text-white">
            <MapPinIcon className="h-6 w-6" />
          </span>
          <p className="mt-4 font-medium">Todavía no tienes una dirección guardada</p>
          <p className="mt-1 max-w-xs text-sm text-muted-foreground">
            Agrégala para poder pedir en tus negocios favoritos.
          </p>
          <div className="mt-5">
            <AddressFormDialog mode="create" />
          </div>
        </div>
      )}
    </div>
  )
}