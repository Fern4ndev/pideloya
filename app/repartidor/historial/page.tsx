import { DeliveryHistoryTable } from '@/components/features/deliveries/DeliveryHistoryTable'
import { PageHeader } from '@/components/layout/PageHeader'
import { PageContainer } from '@/components/layout/PageContainer'

export default async function HistorialPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>
}) {
  const { page } = await searchParams

  return (
    <PageContainer size="full">
      <PageHeader
        title="Historial"
        description="Todas las entregas que has aceptado, con su estado y detalle."
      />

      <div className="mt-6">
        <DeliveryHistoryTable page={page} />
      </div>
    </PageContainer>
  )
}