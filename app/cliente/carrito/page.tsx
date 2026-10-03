import { createClient } from '@/lib/db/server'
import { CartClient } from '@/components/features/cart/CartClient'
import { ClientPageContainer } from '@/components/layout/ClientPageContainer'

export default async function CartPage() {
  const supabase = await createClient()

  const { data: addresses } = await supabase
    .from('addresses')
    .select('id, label, address_text')
    .order('created_at', { ascending: false })
    .limit(1)

  return (
    <ClientPageContainer size="wide">
      <h1 className="text-2xl font-semibold tracking-tight">Tu carrito</h1>
      <p className="mt-1 text-sm text-muted-foreground">Revisa tu pedido antes de confirmarlo.</p>

      <div className="mt-6">
        <CartClient
          addresses={(addresses ?? []).map((a) => ({
            id: a.id,
            label: a.label,
            addressText: a.address_text,
          }))}
        />
      </div>
    </ClientPageContainer>
  )
}