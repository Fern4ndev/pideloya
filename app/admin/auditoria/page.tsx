import { createClient } from '@/lib/db/server'
import { AUDIT_ACTIONS, type AuditAction } from '@/lib/admin/audit-log'
import { TablePagination } from '@/components/ui/table-pagination'
import { getPagination, parsePage, PAGE_SIZE } from '@/lib/pagination'
import { PageHeader } from '@/components/layout/PageHeader'
import { PageContainer } from '@/components/layout/PageContainer'
import { EmptyState } from '@/components/ui/empty-state'
import {
  ScrollTextIcon,
  SearchXIcon,
  StoreIcon,
  UserIcon,
} from 'lucide-react'

/**
 * Etiquetas legibles de las acciones del catálogo (lib/admin/audit-log).
 * Se construyen desde la misma fuente para no desincronizarse.
 */
const ACTION_LABELS: Record<string, string> = Object.fromEntries(
  Object.values(AUDIT_ACTIONS).map((action) => [
    action,
    action
      .replaceAll('_', ' ')
      .replace(/^./, (c) => c.toUpperCase()),
  ])
)

type AuditRow = {
  id: string
  action: string
  target_table: string
  target_id: string
  metadata: Record<string, unknown> | null
  created_at: string
  actor: {
    id: string
    full_name: string
  } | null
}

// Validación por whitelist (mismo principio que las columnas ordenables):
// el valor de ?action= llega directo a un filtro de igualdad.
const VALID_ACTIONS: readonly string[] = Object.values(AUDIT_ACTIONS)

function isValidDateParam(value: string | undefined): value is string {
  return !!value && /^\d{4}-\d{2}-\d{2}$/.test(value)
}

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string
    action?: string
    from?: string
    to?: string
  }>
}) {
  const supabase = await createClient()
  const { page, action, from, to } = await searchParams

  // `action` es string desde la URL; VALID_ACTIONS lo valida y el cast
  // une el tipo con el literal de la columna para .eq().
  const actionFilter =
    action && VALID_ACTIONS.includes(action) ? (action as AuditAction) : undefined
  const fromFilter = isValidDateParam(from) ? from : undefined
  const toFilter = isValidDateParam(to) ? to : undefined

  function countRows() {
    let builder = supabase
      .from('admin_audit_log')
      .select('id', { count: 'exact', head: true })
    builder = applyFilters(builder)
    return builder
  }

  function dataRows() {
    // El actor viene del FK: un solo embed (cero N+1). Solo se necesita
    // para mostrar el nombre; si el admin fue eliminado, actor = null
    // (ON DELETE SET NULL) y la fila se muestra con "—".
    const builder = supabase.from('admin_audit_log').select(
      'id, action, target_table, target_id, metadata, created_at, actor:profiles!admin_audit_log_actor_profile_id_fkey(id, full_name)'
    )
    return applyFilters(builder)
  }

  // El count aplica EXACTAMENTE los mismos filtros que los datos.
  function applyFilters<
    T extends {
      eq: (col: string, val: string) => T
      gte: (col: string, val: string) => T
      lt: (col: string, val: string) => T
    },
  >(builder: T): T {
    if (actionFilter) builder = builder.eq('action', actionFilter)
    if (fromFilter) builder = builder.gte('created_at', `${fromFilter}T00:00:00Z`)
    if (toFilter) {
      // Rango inclusivo del día `to`: lt del día siguiente a medianoche.
      const nextDay = new Date(`${toFilter}T00:00:00Z`)
      nextDay.setUTCDate(nextDay.getUTCDate() + 1)
      builder = builder.lt('created_at', nextDay.toISOString())
    }
    return builder
  }

  const offset = (parsePage(page) - 1) * PAGE_SIZE

  const [countResult, dataResult] = await Promise.all([
    countRows(),
    dataRows()
      .order('created_at', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1),
  ])

  const total = countResult.count ?? 0
  const pagination = getPagination(total, page)

  let rows = dataResult.data as AuditRow[] | null
  let error = dataResult.error

  if (!error && pagination.start !== offset) {
    const retry = await dataRows()
      .order('created_at', { ascending: false })
      .range(pagination.start, pagination.start + PAGE_SIZE - 1)
    rows = retry.data as AuditRow[] | null
    error = retry.error
  }

  // La fecha se formatea en el servidor (evita hydration mismatch); la
  // página es 100% server component: sin badges de cliente ni Realtime.
  const entries = (rows ?? []).map((row) => ({
    ...row,
    formattedDate: new Date(row.created_at).toLocaleString('es-PE', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }),
  }))

  const params = new URLSearchParams()
  if (actionFilter) params.set('action', actionFilter)
  if (fromFilter) params.set('from', fromFilter)
  if (toFilter) params.set('to', toFilter)
  const basePath = params.toString()
    ? `/admin/auditoria?${params.toString()}`
    : '/admin/auditoria'

  const hasFilters = !!actionFilter || !!fromFilter || !!toFilter

  return (
    <PageContainer size="full">
      <PageHeader
        title="Auditoría"
        description="Registro de acciones administrativas: quién ejecutó qué y cuándo. Solo lectura."
      />

      <form
        method="GET"
        action="/admin/auditoria"
        className="mt-6 flex flex-wrap items-end gap-3"
      >
        <div className="space-y-1">
          <label
            htmlFor="audit-action"
            className="text-xs text-muted-foreground"
          >
            Acción
          </label>
          <select
            id="audit-action"
            name="action"
            defaultValue={actionFilter ?? ''}
            className="h-8 rounded-2xl border border-transparent bg-input/50 px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">Todas las acciones</option>
            {Object.entries(ACTION_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label htmlFor="audit-from" className="text-xs text-muted-foreground">
            Desde
          </label>
          <input
            id="audit-from"
            type="date"
            name="from"
            defaultValue={fromFilter ?? ''}
            className="h-8 rounded-2xl border border-transparent bg-input/50 px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="audit-to" className="text-xs text-muted-foreground">
            Hasta
          </label>
          <input
            id="audit-to"
            type="date"
            name="to"
            defaultValue={toFilter ?? ''}
            className="h-8 rounded-2xl border border-transparent bg-input/50 px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <button
          type="submit"
          className="h-8 rounded-2xl bg-primary px-4 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          Aplicar
        </button>
      </form>

      {error && (
        <p role="alert" className="mt-6 text-sm text-destructive">
          No se pudo cargar el registro de auditoría.
        </p>
      )}

      {!error && entries.length > 0 && (
        <>
          <div className="mt-4 overflow-hidden rounded-2xl border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b [&_th]:h-10 [&_th]:px-3 [&_th]:text-left [&_th]:font-medium [&_th]:whitespace-nowrap">
                  <th className="w-44">Fecha</th>
                  <th className="w-44">Actor</th>
                  <th className="w-48">Acción</th>
                  <th className="w-40">Objetivo</th>
                  <th>Detalle</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => {
                  const isRestaurant =
                    entry.target_table === 'restaurants'
                  const TargetIcon = isRestaurant ? StoreIcon : UserIcon

                  return (
                    <tr
                      key={entry.id}
                      className="border-b align-top hover:bg-muted/50 [&_td]:px-3 [&_td]:py-2.5"
                    >
                      <td className="whitespace-nowrap text-muted-foreground tabular-nums">
                        {entry.formattedDate}
                      </td>
                      <td className="font-medium">
                        {entry.actor?.full_name ?? '—'}
                      </td>
                      <td>
                        {ACTION_LABELS[entry.action] ?? entry.action}
                      </td>
                      <td>
                        {entry.target_id ? (
                          <>
                            <span className="flex items-center gap-1.5 text-muted-foreground">
                              <TargetIcon className="h-3.5 w-3.5 shrink-0" />
                              <span className="truncate" title={entry.target_id}>
                                {isRestaurant ? 'Restaurante' : 'Perfil'}{' '}
                                {entry.target_id.slice(0, 8)}…
                              </span>
                            </span>
                            {isRestaurant && (
                              <a
                                href={`/admin/restaurantes?q=${entry.target_id}`}
                                className="mt-0.5 inline-block text-xs text-primary underline-offset-4 hover:underline"
                              >
                                Ver detalle
                              </a>
                            )}
                          </>
                        ) : (
                          // Entrada de LOTE (Fase 8): target_id es null y
                          // los ids afectados viven en metadata.batchIds.
                          <span className="flex items-center gap-1.5 text-muted-foreground">
                            <TargetIcon className="h-3.5 w-3.5 shrink-0" />
                            Lote
                          </span>
                        )}
                      </td>
                      <td>
                        {entry.metadata ? (
                          <details className="group">
                            <summary className="cursor-pointer select-none text-xs text-primary underline-offset-4 hover:underline">
                              Ver metadata
                            </summary>
                            <pre className="mt-1.5 max-w-md overflow-x-auto rounded-lg bg-muted/60 p-2 text-xs leading-relaxed">
                              {JSON.stringify(entry.metadata, null, 2)}
                            </pre>
                          </details>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex justify-end">
            <TablePagination
              basePath={basePath}
              page={pagination.page}
              pageCount={pagination.pageCount}
              alwaysShow={true}
            />
          </div>
        </>
      )}

      {!error && entries.length === 0 && (
        <EmptyState
          icon={hasFilters ? SearchXIcon : ScrollTextIcon}
          title={
            hasFilters
              ? 'No hay registros con esos filtros'
              : 'Todavía no hay acciones registradas'
          }
          description={
            hasFilters
              ? 'Prueba ampliando el rango de fechas o cambiando la acción.'
              : 'Cada acción administrativa (aprobar, desactivar, anonimizar, editar, eliminar) aparecerá aquí automáticamente.'
          }
          className="mt-10"
        />
      )}
    </PageContainer>
  )
}
