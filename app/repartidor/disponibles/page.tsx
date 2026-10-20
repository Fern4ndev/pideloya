import { AvailableOrdersClient } from '@/components/features/deliveries/AvailableOrdersClient'
import { PageHeader } from '@/components/layout/PageHeader'
import { PageContainer } from '@/components/layout/PageContainer'
import { createClient } from '@/lib/db/server'
import { getSessionContext } from '@/lib/auth/session'

export default async function AvailableOrdersPage() {
  const supabase = await createClient()
  // La cadena de identidad (getUser + profiles) vive en lib/auth/session.ts
  // con cache() de React.
  const session = await getSessionContext()

  // El flag es del repartidor y no viaja en `/api/v1/orders` (esa respuesta la
  // consumen varios clientes y no debe cargar preferencias del ofertante). Se
  // lee acá una sola vez y se baja por props; si falta el dato, `true` = el
  // comportamiento de siempre (mismo criterio que la vista del cliente).
  const { data: profile } = session
    ? await supabase
        .from('profiles')
        .select('accepts_pay_on_delivery')
        .eq('id', session.profileId)
        .maybeSingle()
    : { data: null }

  return (
    <PageContainer size="md">
      <PageHeader
        title="Pedidos disponibles"
        description="Acepta un pedido para empezar a repartirlo."
      />
      <AvailableOrdersClient
        acceptsPayOnDelivery={profile?.accepts_pay_on_delivery ?? true}
      />
    </PageContainer>
  )
}
