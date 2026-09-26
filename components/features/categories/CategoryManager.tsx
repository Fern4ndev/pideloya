'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  createCategory,
  updateCategory,
  deleteCategory,
} from '@/lib/actions/categories'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
  const [newName, setNewName] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const { success } = useToast()

  function handleCreate() {
    setError(null)
    if (!newName.trim()) return

    startTransition(async () => {
      try {
        await createCategory({ name: newName.trim() })
        setNewName('')
        router.refresh()
        success('Categoría creada')
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Algo salió mal')
      }
    })
  }

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
      <div className="flex gap-2">
        <Input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Ej. Bebidas"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              handleCreate()
            }
          }}
        />
        <Button type="button" variant="lime" disabled={isPending} onClick={handleCreate}>
          Agregar
        </Button>
      </div>

      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

      <div className="space-y-2">
        {initialCategories.map((category) => (
          <div
            key={category.id}
            className="flex items-center gap-2 rounded-lg border px-3 py-2"
          >
            {editingId === category.id ? (
              <>
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
              </>
            ) : (
              <>
                <span className="flex-1 text-sm">{category.name}</span>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  title="Editar"
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
                >
                  <TrashIcon className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        ))}
      </div>

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