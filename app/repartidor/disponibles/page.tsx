import { AvailableOrdersClient } from '@/components/features/deliveries/AvailableOrdersClient'
import { PageHeader } from '@/components/layout/PageHeader'
import { PageContainer } from '@/components/layout/PageContainer'
import { createClient } from '@/lib/db/server'

export default async function AvailableOrdersPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // El flag es del repartidor y no viaja en `/api/v1/orders` (esa respuesta la
  // consumen varios clientes y no debe cargar preferencias del ofertante). Se
  // lee acá una sola vez y se baja por props; si falta el dato, `true` = el
  // comportamiento de siempre (mismo criterio que la vista del cliente).
  const { data: profile } = user
    ? await supabase
        .from('profiles')
        .select('accepts_pay_on_delivery')
        .eq('auth_id', user.id)
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
