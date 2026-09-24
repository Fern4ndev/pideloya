'use client'

import { useState, useMemo, useEffect } from 'react'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { TablePagination } from '@/components/ui/table-pagination'
import { PAGE_SIZE } from '@/lib/pagination'
import { UserRowActions } from './UserRowActions'
import { SearchIcon } from 'lucide-react'

type Customer = {
  id: string
  full_name: string
  email: string | null
  phone: string | null
  is_active: boolean
  created_at: string
}

export function CustomerTable({ customers }: { customers: Customer[] }) {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  const filtered = useMemo(() => {
    if (!search.trim()) return customers
    const q = search.toLowerCase()
    return customers.filter((c) => {
      return (
        c.full_name.toLowerCase().includes(q) ||
        (c.email ?? '').toLowerCase().includes(q) ||
        (c.phone ?? '').toLowerCase().includes(q)
      )
    })
  }, [customers, search])

  useEffect(() => {
    setPage(1)
  }, [filtered])

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, pageCount)
  const pageStart = (safePage - 1) * PAGE_SIZE
  const paged = filtered.slice(pageStart, pageStart + PAGE_SIZE)

  return (
    <div className="mt-6 space-y-4">
      <div className="relative max-w-sm">
        <SearchIcon className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar por nombre, email o teléfono..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-8"
        />
      </div>

      {filtered.length > 0 ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">N°</TableHead>
              <TableHead className="w-40">Nombre</TableHead>
              <TableHead className="w-56">Email</TableHead>
              <TableHead className="w-32">Teléfono</TableHead>
              <TableHead className="w-24">Estado</TableHead>
              <TableHead className="w-28 text-center">Registro</TableHead>
              <TableHead className="w-28">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paged.map((c, index) => {
              const createdAt = new Date(c.created_at)

              return (
                <TableRow key={c.id}>
                  <TableCell className="text-muted-foreground">
                    {pageStart + index + 1}
                  </TableCell>
                  <TableCell className="font-medium">{c.full_name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {c.email ?? '—'}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {c.phone ?? '—'}
                  </TableCell>
                  <TableCell>
                    {c.is_active ? (
                      <Badge variant="secondary">Activo</Badge>
                    ) : (
                      <Badge variant="outline">Inactivo</Badge>
                    )}
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
      ) : (
        <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
          No se encontraron clientes para &quot;{search}&quot;.
        </div>
      )}

      {filtered.length > 0 && (
        <TablePagination
          page={safePage}
          pageCount={pageCount}
          onPageChange={setPage}
        />
      )}
    </div>
  )
}
