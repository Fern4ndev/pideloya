'use client'

import { useState, useTransition, type SubmitEvent } from 'react'
import { inviteRestaurantOwner } from '@/lib/actions/admin'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

const EMPTY_FORM = {
  restaurantName: '',
  slug: '',
  addressText: '',
  ownerEmail: '',
  ownerFullName: '',
}

/** Mismo criterio que el slugify del servidor, para mostrar el preview. */
function slugPreview(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

export function InviteRestaurantDialog() {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [slugTouched, setSlugTouched] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleNameChange(value: string) {
    setForm((f) => ({
      ...f,
      restaurantName: value,
      // Mientras el admin no haya tocado el slug a mano, se autogenera.
      slug: slugTouched ? f.slug : slugPreview(value),
    }))
  }

  function handleSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      try {
        await inviteRestaurantOwner(form)
        setForm(EMPTY_FORM)
        setSlugTouched(false)
        setOpen(false)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Algo salió mal')
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" />}>
        Invitar restaurante
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invitar un negocio</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="restaurantName">Nombre del negocio</Label>
            <Input
              id="restaurantName"
              value={form.restaurantName}
              onChange={(e) => handleNameChange(e.target.value)}
              required
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="slug">
              Slug para la URL{' '}
              <span className="font-normal text-muted-foreground">
                (se genera solo, puedes editarlo)
              </span>
            </Label>
            <Input
              id="slug"
              value={form.slug}
              onChange={(e) => {
                setSlugTouched(true)
                setForm((f) => ({ ...f, slug: e.target.value }))
              }}
              placeholder="polleria-el-buen-sabor"
              required
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="addressText">Dirección</Label>
            <Input
              id="addressText"
              value={form.addressText}
              onChange={(e) =>
                setForm((f) => ({ ...f, addressText: e.target.value }))
              }
              required
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="ownerFullName">Nombre del dueño</Label>
            <Input
              id="ownerFullName"
              value={form.ownerFullName}
              onChange={(e) =>
                setForm((f) => ({ ...f, ownerFullName: e.target.value }))
              }
              required
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="ownerEmail">Correo del dueño</Label>
            <Input
              id="ownerEmail"
              type="email"
              value={form.ownerEmail}
              onChange={(e) =>
                setForm((f) => ({ ...f, ownerEmail: e.target.value }))
              }
              required
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Enviando invitación…' : 'Enviar invitación'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}