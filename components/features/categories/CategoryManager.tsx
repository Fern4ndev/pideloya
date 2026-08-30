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
  const [isPending, startTransition] = useTransition()

  function handleCreate() {
    setError(null)
    if (!newName.trim()) return

    startTransition(async () => {
      try {
        await createCategory({ name: newName.trim() })
        setNewName('')
        router.refresh()
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
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Algo salió mal')
      }
    })
  }

  function handleDelete(id: string) {
    if (
      !confirm(
        '¿Eliminar esta categoría? Los productos que la usaban quedarán sin categoría.'
      )
    )
      return

    startTransition(async () => {
      try {
        await deleteCategory(id)
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Algo salió mal')
      }
    })
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
        <Button type="button" disabled={isPending} onClick={handleCreate}>
          Agregar
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

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
                  size="sm"
                  variant="ghost"
                  onClick={() => startEditing(category)}
                >
                  Editar
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                  disabled={isPending}
                  onClick={() => handleDelete(category.id)}
                >
                  Eliminar
                </Button>
              </>
            )}
          </div>
        ))}

        {initialCategories.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Todavía no tienes categorías.
          </p>
        )}
      </div>
    </div>
  )
}