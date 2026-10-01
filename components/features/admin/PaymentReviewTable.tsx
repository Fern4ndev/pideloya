import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { TableShell } from '@/components/ui/table-shell'
import { AdminTableShell, type AdminTableShellPagination } from './AdminTableShell'
import { PAYMENT_REVIEW_STATUS_OPTIONS } from '@/lib/admin/query-builders'

export type PaymentReviewTableRow = {
  id: string
  orderId: string
  /** Qué se encontró, en texto: es lo que el admin tiene que poder leer. */
  issue: string
  amountLabel: string
  driverName: string | null
  /** Formateada en el servidor: evita diferencias de ICU entre Node y el navegador. */
  createdLabel: string
}

/**
 * Vista de conciliación (Fase 8.3): los tres hallazgos que no son incidencias
 * reportadas por una parte — entregas sin constancia de pago al restaurante,
 * cobros distintos a lo anunciado y pedidos entregados con ON_DELIVERY sin
 * cobro registrado (alerta de integridad).
 *
 * Server Component y sin acciones a propósito: acá NO se mueve dinero ni se
 * cambia el estado de nada. Es una cola de revisión; lo que se resuelve por
 * WhatsApp o por soporte ya queda en la conversación, no en la base. Se puede
 * exportar a CSV para trabajar fuera del panel.
 */
export function PaymentReviewTable({
  rows,
  startIndex,
  pagination,
}: {
  rows: PaymentReviewTableRow[]
  startIndex: number
  pagination: AdminTableShellPagination
}) {
  return (
    <AdminTableShell
      statusOptions={PAYMENT_REVIEW_STATUS_OPTIONS}
      exportEntity="payments"
      pagination={pagination}
    >
      <TableShell>
        <Table className="table-fixed">
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">N°</TableHead>
              <TableHead className="w-24">Pedido</TableHead>
              <TableHead>Hallazgo</TableHead>
              <TableHead className="w-24 text-right">Monto</TableHead>
              <TableHead className="w-40">Repartidor</TableHead>
              <TableHead className="w-32">Fecha</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, index) => (
              <TableRow key={row.id}>
                <TableCell className="tabular-nums text-muted-foreground">
                  {startIndex + index + 1}
                </TableCell>
                <TableCell className="font-medium tabular-nums">
                  #{row.orderId.slice(0, 8)}
                </TableCell>
                <TableCell className="text-sm">{row.issue}</TableCell>
                <TableCell className="text-right tabular-nums">{row.amountLabel}</TableCell>
                <TableCell className="truncate text-sm text-muted-foreground">
                  {row.driverName ?? '—'}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {row.createdLabel}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableShell>
    </AdminTableShell>
  )
}
