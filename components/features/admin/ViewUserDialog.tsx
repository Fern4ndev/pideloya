'use client'

import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

export type UserSummary = {
  id: string
  full_name: string
  email: string | null
  phone: string | null
  is_active: boolean
  created_at: string
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('es-PE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-xl bg-muted/50 px-3 py-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="min-w-0 truncate text-right font-medium">{value}</span>
    </div>
  )
}

export function ViewUserDialog({
  open,
  onOpenChange,
  user,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  user: UserSummary | null
}) {
  if (!user) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Detalle del cliente</DialogTitle>
          <DialogDescription>Información de la cuenta del cliente.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Row label="Nombre" value={user.full_name} />
            <Row label="Email" value={user.email ?? '—'} />
            <Row label="Teléfono" value={user.phone ?? '—'} />
            <Row
              label="Estado"
              value={
                user.is_active ? (
                  <Badge variant="secondary">Activo</Badge>
                ) : (
                  <Badge variant="outline">Inactivo</Badge>
                )
              }
            />
            <Row label="Registro" value={formatDate(user.created_at)} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
