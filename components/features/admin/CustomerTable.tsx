'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { UserRowActions } from './UserRowActions'
import { SearchIcon } from 'lucide-react'
import type { UserSummary } from './ViewUserDialog'

export function CustomerTable({
  customers,
  initialQuery,
  startIndex,
}: {
  customers: UserSummary[]
  initialQuery: string
  startIndex: number
}) {
  const router = useRouter()
  const [search, setSearch] = useState(initialQuery)

  function submitSearch(e: React.FormEvent) {
    e.preventDefault()
    const q = search.trim()
    router.replace(q ? `/admin/usuarios?q=${encodeURIComponent(q)}` : '/admin/usuarios')
  }

  return (
    <div className="mt-6 space-y-4">
      <form onSubmit={submitSearch} className="relative max-w-sm">
        <SearchIcon className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar por nombre o email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-8"
        />
      </form>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">N°</TableHead>
            <TableHead className="w-40">Nombre</TableHead>
            <TableHead className="w-56">Email</TableHead>
            <TableHead className="w-28 text-center">Registro</TableHead>
            <TableHead className="w-28">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {customers.map((c, index) => {
            const createdAt = new Date(c.created_at)

            return (
              <TableRow key={c.id}>
                <TableCell className="text-muted-foreground">
                  {startIndex + index + 1}
                </TableCell>
                <TableCell className="font-medium">{c.full_name}</TableCell>
                <TableCell className="text-muted-foreground">
                  {c.email ?? '—'}
                </TableCell>
                <TableCell className="text-center text-muted-foreground">
                  {createdAt.toLocaleDateString('es-PE', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                  })}
                </TableCell>
                <TableCell>
                  <UserRowActions user={c} />
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
