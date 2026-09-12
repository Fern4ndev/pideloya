'use client'

import { useState, useMemo } from 'react'
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
import { RestaurantRowActions } from './RestaurantRowActions'
import { SearchIcon } from 'lucide-react'

type Restaurant = {
  id: string
  name: string
  slug: string
  address_text: string | null
  whatsapp: string | null
  food_type: string | null
  is_approved: boolean
  is_active: boolean
  created_at: string
  restaurant_members: {
    profiles: {
      full_name: string | null
    } | null
  }[] | null
}

export function RestaurantTable({ restaurants }: { restaurants: Restaurant[] }) {
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    if (!search.trim()) return restaurants
    const q = search.toLowerCase()
    return restaurants.filter((r) => {
      const ownerName =
        r.restaurant_members?.[0]?.profiles?.full_name ?? ''
      return (
        r.name.toLowerCase().includes(q) ||
        ownerName.toLowerCase().includes(q) ||
        (r.food_type ?? '').toLowerCase().includes(q)
      )
    })
  }, [restaurants, search])

  return (
    <div className="mt-6 space-y-4">
      <div className="relative max-w-sm">
        <SearchIcon className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar por negocio, dueño o tipo..."
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
              <TableHead>Negocio</TableHead>
              <TableHead>Dueño</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead className="w-28">WhatsApp</TableHead>
              <TableHead className="w-24">Estado</TableHead>
              <TableHead className="w-28 text-center">Registro</TableHead>
              <TableHead className="w-28">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((r, index) => {
              const ownerName =
                r.restaurant_members?.[0]?.profiles?.full_name ?? '—'
              const createdAt = new Date(r.created_at)

              return (
                <TableRow key={r.id}>
                  <TableCell className="text-muted-foreground">
                    {index + 1}
                  </TableCell>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell>{ownerName}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {r.food_type ?? '—'}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {r.whatsapp ?? '—'}
                  </TableCell>
                  <TableCell>
                    {r.is_approved ? (
                      <Badge className="bg-green-100 text-green-800">Aprobado</Badge>
                    ) : (
                      <Badge variant="outline">Pendiente</Badge>
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
                    <RestaurantRowActions
                      id={r.id}
                      name={r.name}
                      isApproved={r.is_approved}
                      isActive={r.is_active}
                      restaurant={{
                        id: r.id,
                        name: r.name,
                        food_type: r.food_type,
                        whatsapp: r.whatsapp,
                        address_text: r.address_text,
                      }}
                    />
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      ) : (
        <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
          No se encontraron restaurantes para &quot;{search}&quot;.
        </div>
      )}
    </div>
  )
}
