'use client'

import { useState } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { TableShell } from '@/components/ui/table-shell'
import { AdminTableShell, type AdminTableShellPagination } from './AdminTableShell'
import { ResolveIncidentDialog } from './ResolveIncidentDialog'
import {
  PAYMENT_INCIDENT_KIND_COPY,
  PAYMENT_INCIDENT_REPORTER_COPY,
} from '@/lib/constants/payment-incident'
import { PAYMENT_REVIEW_STATUS_OPTIONS } from '@/lib/admin/query-builders'

export type PaymentIncidentTableRow = {
  id: string
  orderId: string
  kind: string
  reporterName: string | null
  reporterRole: string
  note: string | null
  /** Formateada en el servidor: evita diferencias de ICU entre Node y el navegador. */
  createdLabel: string
}

export function PaymentIncidentsTable({
  incidents,
  startIndex,
  pagination,
}: {
  incidents: PaymentIncidentTableRow[]
  startIndex: number
  pagination: AdminTableShellPagination
}) {
  const [target, setTarget] = useState<PaymentIncidentTableRow | null>(null)

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
              <TableHead className="w-40">Reportante</TableHead>
              <TableHead className="w-48">Motivo</TableHead>
              <TableHead>Nota</TableHead>
              <TableHead className="w-32">Fecha</TableHead>
              <TableHead className="w-28 text-center">Acción</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {incidents.map((incident, index) => (
              <TableRow key={incident.id}>
                <TableCell className="tabular-nums text-muted-foreground">
                  {startIndex + index + 1}
                </TableCell>
                <TableCell className="font-medium tabular-nums">
                  #{incident.orderId.slice(0, 8)}
                </TableCell>
                <TableCell>
                  <span className="flex flex-col">
                    <span className="truncate">{incident.reporterName ?? '—'}</span>
                    <span className="text-xs text-muted-foreground">
                      {PAYMENT_INCIDENT_REPORTER_COPY[incident.reporterRole] ??
                        incident.reporterRole}
                    </span>
                  </span>
                </TableCell>
                <TableCell className="text-sm">
                  {PAYMENT_INCIDENT_KIND_COPY[
                    incident.kind as keyof typeof PAYMENT_INCIDENT_KIND_COPY
                  ] ?? incident.kind}
                </TableCell>
                <TableCell className="truncate text-sm text-muted-foreground">
                  {incident.note ?? '—'}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {incident.createdLabel}
                </TableCell>
                <TableCell className="text-center">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setTarget(incident)}
                  >
                    Resolver
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableShell>

      <ResolveIncidentDialog
        open={target !== null}
        onOpenChange={(open) => {
          if (!open) setTarget(null)
        }}
        incident={
          target
            ? {
                id: target.id,
                orderRef: `#${target.orderId.slice(0, 8)}`,
                kind: target.kind,
                reporterName: target.reporterName,
              }
            : null
        }
      />
    </AdminTableShell>
  )
}
