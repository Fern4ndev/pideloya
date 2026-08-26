import { createClient } from '@/lib/db/server'
import { AddAddressDialog } from '@/components/features/addresses/AddAddressDialog'
import { DeleteAddressButton } from '@/components/features/addresses/DeleteAddressButton'

export default async function AddressesPage() {
  const supabase = await createClient()

  const { data: addresses, error } = await supabase
    .from('addresses')
    .select('id, label, address_text, reference')
    .order('created_at', { ascending: false })

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Tus direcciones
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Las usamos para saber a dónde llevar tu pedido.
          </p>
        </div>
        <AddAddressDialog />
      </div>

      {error && (
        <p className="mt-6 text-sm text-destructive">
          No se pudieron cargar tus direcciones.
        </p>
      )}

      {!error && addresses && addresses.length > 0 && (
        <div className="mt-6 space-y-3">
          {addresses.map((a) => (
            <div
              key={a.id}
              className="flex items-start justify-between rounded-xl border p-4"
            >
              <div>
                <p className="font-medium">{a.label || 'Dirección'}</p>
                <p className="text-sm text-muted-foreground">
                  {a.address_text}
                </p>
                {a.reference && (
                  <p className="text-xs text-muted-foreground">
                    {a.reference}
                  </p>
                )}
              </div>
              <DeleteAddressButton addressId={a.id} />
            </div>
          ))}
        </div>
      )}

      {!error && addresses && addresses.length === 0 && (
        <div className="mt-10 flex flex-col items-center rounded-xl border border-dashed px-6 py-14 text-center">
          <p className="font-medium">
            Todavía no tienes direcciones guardadas
          </p>
          <p className="mt-1 max-w-xs text-sm text-muted-foreground">
            Agrega una para poder pedir en tus negocios favoritos.
          </p>
        </div>
      )}
    </div>
  )
}