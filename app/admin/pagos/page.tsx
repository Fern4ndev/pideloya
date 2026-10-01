import { createClient } from '@/lib/db/server'
import { PageHeader } from '@/components/layout/PageHeader'
import { PageContainer } from '@/components/layout/PageContainer'
import { EmptyState } from '@/components/ui/empty-state'
import { getPagination } from '@/lib/pagination'
import {
  PAYMENT_REVIEW_FILTERS,
  PAYMENT_REVIEW_LABELS,
  PAYMENT_REVIEW_LIMIT,
  fetchOpenPaymentIncidents,
  fetchPaymentReconciliationRows,
  parseStatusFilter,
} from '@/lib/admin/query-builders'
import { PaymentIncidentsTable } from '@/components/features/admin/PaymentIncidentsTable'
import { PaymentReviewTable } from '@/components/features/admin/PaymentReviewTable'
import { HandCoinsIcon, SearchXIcon } from 'lucide-react'

/**
 * /admin/pagos — conciliación de pagos (Fase 8.3 del plan "Pagar al recibir").
 *
 * Cuatro vistas en una sola pantalla, elegidas con `?status=` (el MISMO
 * parámetro que las otras tablas admin, para reutilizar `AdminTableShell` y el
 * export CSV tal cual):
 *
 *   open      → incidencias REPORTADAS por una parte (bandeja con acción).
 *   unpaid    → entregados sin constancia de pago al restaurante.
 *   mismatch  → `collected_method <> payment_method` (el desvío válido de D4:
 *               no es un error, es un dato que el admin audita).
 *   integrity → ON_DELIVERY entregado sin `collected_at` (debería ser imposible:
 *               si aparece, algo se saltó `complete_delivery`).
 *
 * Paginación EN MEMORIA, no en el servidor: `mismatch` compara dos columnas
 * entre sí y PostgREST no puede filtrar eso, así que la fila se descarta en JS.
 * El volumen es bajo por diseño (PAYMENT_REVIEW_LIMIT = una cola de soporte, no
 * un histórico); si algún día no lo fuera, el problema es la cola, no la tabla.
 */
export default async function AdminPaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; status?: string }>
}) {
  const supabase = await createClient()
  const { page, status } = await searchParams

  const filter = parseStatusFilter(PAYMENT_REVIEW_FILTERS, status) ?? 'open'
  const filterLabel = PAYMENT_REVIEW_LABELS[filter]

  let incidents: Awaited<ReturnType<typeof fetchOpenPaymentIncidents>> = []
  let reviewRows: Awaited<ReturnType<typeof fetchPaymentReconciliationRows>> = []
  let loadError = false

  try {
    if (filter === 'open') {
      incidents = await fetchOpenPaymentIncidents(supabase)
    } else {
      reviewRows = await fetchPaymentReconciliationRows(supabase, filter)
    }
  } catch (err) {
    console.error('[admin/pagos] no se pudo cargar la cola de pagos:', err)
    loadError = true
  }

  const allRows = filter === 'open' ? incidents : reviewRows
  const pagination = getPagination(allRows.length, page)
  const basePath = `/admin/pagos?status=${filter}`

  // Etiquetas de fecha formateadas en el SERVIDOR: el cliente solo renderiza el
  // string, así que no hay riesgo de mismatch de hidratación por ICU.
  const formatDate = (value: string) =>
    new Date(value).toLocaleDateString('es-PE', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    })

  const incidentRows = incidents
    .slice(pagination.start, pagination.end)
    .map((incident) => ({
      id: incident.id,
      orderId: incident.orderId,
      kind: incident.kind,
      reporterName: incident.reporterName,
      reporterRole: incident.reporterRole,
      note: incident.note,
      createdLabel: formatDate(incident.createdAt),
    }))

  const reviewTableRows = reviewRows
    .slice(pagination.start, pagination.end)
    .map((row) => ({
      id: row.id,
      orderId: row.orderId,
      issue: row.issue,
      amountLabel: row.amount === null ? '—' : `S/ ${Number(row.amount).toFixed(2)}`,
      driverName: row.driverName,
      createdLabel: formatDate(row.createdAt),
    }))

  const isEmpty = allRows.length === 0

  return (
    <PageContainer size="full">
      <PageHeader
        title="Pagos"
        description="Incidencias reportadas y la conciliación del cobro al recibir. Resolver una incidencia no mueve dinero: deja constancia de la gestión."
      />

      {loadError && (
        <p role="alert" className="mt-6 text-sm text-destructive">
          No se pudo cargar la cola de pagos.
        </p>
      )}

      {!loadError && !isEmpty && filter === 'open' && (
        <>
          <IncidentCountNote count={allRows.length} label={filterLabel} />
          <PaymentIncidentsTable
            incidents={incidentRows}
            startIndex={pagination.start}
            pagination={{ page: pagination.page, pageCount: pagination.pageCount, basePath }}
          />
        </>
      )}

      {!loadError && !isEmpty && filter !== 'open' && (
        <>
          <IncidentCountNote count={allRows.length} label={filterLabel} />
          <PaymentReviewTable
            rows={reviewTableRows}
            startIndex={pagination.start}
            pagination={{ page: pagination.page, pageCount: pagination.pageCount, basePath }}
          />
        </>
      )}

      {!loadError && isEmpty && (
        <EmptyState
          icon={filter === 'open' ? HandCoinsIcon : SearchXIcon}
          title={
            filter === 'open'
              ? 'No hay incidencias de pago abiertas'
              : `Sin resultados en "${filterLabel}"`
          }
          description={
            filter === 'open'
              ? 'Cuando el repartidor o el restaurante reporten un problema con el pago, aparecerá aquí.'
              : 'Cambia el filtro para ver otras vistas de conciliación.'
          }
          className="mt-10"
        />
      )}
    </PageContainer>
  )
}

/**
 * Contador + recordatorio del tope. Es honestidad de UI: si la cola llegó al
 * tope, la tabla NO está mostrando todo y hay que decirlo (un admin que cree
 * que vio 200 de 350 incidencias toma peores decisiones).
 */
function IncidentCountNote({ count, label }: { count: number; label: string }) {
  const capped = count >= PAYMENT_REVIEW_LIMIT
  return (
    <p className="mt-6 text-sm text-muted-foreground">
      <span className="font-medium text-foreground">{count}</span>{' '}
      {count === 1 ? 'fila' : 'filas'} en “{label}”.
      {capped && (
        <>
          {' '}
          La cola llegó al tope de {PAYMENT_REVIEW_LIMIT}: hay más filas de las que
          muestra esta tabla.
        </>
      )}
    </p>
  )
}
