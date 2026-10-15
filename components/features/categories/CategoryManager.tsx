'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  updateCategory,
  deleteCategory,
} from '@/lib/actions/categories'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { TableShell } from '@/components/ui/table-shell'
import { ConfirmDialog } from '@/components/features/admin/ConfirmDialog'
import { PencilIcon, TrashIcon } from 'lucide-react'
import { useToast } from '@/components/ui/toast'

interface Category {
  id: string
  name: string
}

export function CategoryManager({
  initialCategories,
}: {
  initialCategories: Category[]
}) {
  const router = useRouter()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const { success } = useToast()

  function startEditing(category: Category) {
    setEditingId(category.id)
    setEditingName(category.name)
  }

  function handleSaveEdit(id: string) {
    if (!editingName.trim()) return

    startTransition(async () => {
      try {
        await updateCategory(id, { name: editingName.trim() })
        setEditingId(null)
        router.refresh()
        success('Categoría actualizada')
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Algo salió mal')
      }
    })
  }

  async function handleDelete(id: string) {
    await deleteCategory(id)
    router.refresh()
  }

  return (
    <div className="space-y-4">
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

      {initialCategories.length > 0 && (
        <TableShell>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">N°</TableHead>
                <TableHead>Categoría</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {initialCategories.map((category, index) => (
                <TableRow key={category.id}>
                  <TableCell className="tabular-nums text-muted-foreground">
                    {index + 1}
                  </TableCell>
                  <TableCell>
                    {editingId === category.id ? (
                      <Input
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        className="h-8"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            handleSaveEdit(category.id)
                          }
                        }}
                      />
                    ) : (
                      <span className="text-sm font-medium">{category.name}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {editingId === category.id ? (
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          disabled={isPending}
                          onClick={() => handleSaveEdit(category.id)}
                        >
                          Guardar
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setEditingId(null)}
                        >
                          Cancelar
                        </Button>
                      </div>
                    ) : (
                      <div className="flex justify-end gap-1">
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          title="Editar"
                          aria-label={`Editar ${category.name}`}
                          onClick={() => startEditing(category)}
                        >
                          <PencilIcon className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          className="text-destructive hover:text-destructive"
                          onClick={() => setDeleteTargetId(category.id)}
                          title="Eliminar"
                          aria-label={`Eliminar ${category.name}`}
                        >
                          <TrashIcon className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableShell>
      )}

      {initialCategories.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Todavía no tienes categorías.
        </p>
      )}

      <ConfirmDialog
        open={deleteTargetId !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTargetId(null)
        }}
        title="¿Eliminar categoría?"
        description="Los productos que la usaban quedarán sin categoría."
        confirmLabel="Eliminar"
        onConfirm={async () => {
          if (deleteTargetId) await handleDelete(deleteTargetId)
          setDeleteTargetId(null)
        }}
      />
    </div>
  )
}