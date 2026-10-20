'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createCategory } from '@/lib/actions/categories'
import { useToast } from '@/components/ui/toast'
import { PlusIcon } from 'lucide-react'

/**
 * Nueva categoría en modal, desde el header de la página (mismo lugar que
 * "Nuevo producto"). Al guardar cierra, limpia y refresca la tabla.
 */
export function CategoryCreateDialog() {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()
  const { success } = useToast()

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (!next) {
      setName('')
      setError(null)
    }
  }

  function handleCreate() {
    setError(null)
    if (!name.trim()) return

    startTransition(async () => {
      try {
        await createCategory({ name: name.trim() })
        setOpen(false)
        setName('')
        router.refresh()
        success('Categoría creada')
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Algo salió mal')
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button variant="lime" />}>
        <PlusIcon />
        Nueva categoría
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nueva categoría</DialogTitle>
          <DialogDescription>
            Ej. Entradas, Platos de fondo, Bebidas. Aparecerá en tu carta para
            organizar tus productos.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="category-name">Nombre</Label>
          <Input
            id="category-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ej. Bebidas"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                handleCreate()
              }
            }}
          />
        </div>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancelar
          </Button>
          <Button variant="lime" disabled={isPending || !name.trim()} onClick={handleCreate}>
            {isPending ? 'Creando…' : 'Crear categoría'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
