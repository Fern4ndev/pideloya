import { createClient } from '@/lib/db/server'
import { AddressFormDialog } from '@/components/features/addresses/AddressFormDialog'
import { AddressCard } from '@/components/features/addresses/AddressCard'
import { ClientPageContainer } from '@/components/layout/ClientPageContainer'
import { EmptyState } from '@/components/ui/empty-state'
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
    <ClientPageContainer size="narrow">
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
        <EmptyState
          icon={MapPinIcon}
          title="Todavía no tienes una dirección guardada"
          description="Agrégala para poder pedir en tus negocios favoritos."
          className="mt-10 rounded-3xl border-black/10 bg-black/[0.02] py-14 dark:border-white/10 dark:bg-white/[0.02]"
          action={<AddressFormDialog mode="create" />}
        />
      )}
    </ClientPageContainer>
  )
}