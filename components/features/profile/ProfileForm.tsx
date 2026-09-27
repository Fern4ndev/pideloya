'use client'

import { useState, useTransition, type SubmitEvent } from 'react'
import { updateProfile } from '@/lib/actions/profile'
import { PasswordChangeForm } from './PasswordChangeForm'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export interface ProfileFormData {
  fullName: string
  phone: string
  documentType?: string
  documentNumber?: string
  vehicleType?: string
}

export function ProfileForm({
  email,
  initialData,
  showDeliveryFields = false,
  showPasswordChange = false,
  showAccountAvatar = false,
}: {
  email: string
  initialData: ProfileFormData
  showDeliveryFields?: boolean
  showPasswordChange?: boolean
  /**
   * Ancla visual de la cuenta (inicial del nombre con el gradiente de marca)
   * arriba del formulario. Es opt-in porque este formulario lo comparten los
   * cuatro paneles: sólo /cliente/perfil lo activa, el resto no cambia.
   * No requiere ninguna columna nueva — usa `fullName`, que ya viene en
   * `initialData`.
   */
  showAccountAvatar?: boolean
}) {
  const [form, setForm] = useState(initialData)
  const initial = form.fullName.trim().charAt(0).toUpperCase() || '?'
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setSuccess(false)
    startTransition(async () => {
      try {
        await updateProfile(form)
        setSuccess(true)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Algo salió mal')
      }
    })
  }

  return (
    <div className="max-w-md space-y-8">
      {showAccountAvatar && (
        <div className="flex items-center gap-3">
          <Avatar size="lg" className="h-12 w-12">
            <AvatarFallback className="bg-gradient-to-br from-brand-400 to-brand-600 text-base font-semibold text-white">
              {initial}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">
              {form.fullName || 'Tu cuenta'}
            </p>
            <p className="truncate text-xs text-muted-foreground">{email}</p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="space-y-1">
          <Label>Correo</Label>
          <Input value={email} disabled />
        </div>

        <div className="space-y-1">
          <Label htmlFor="fullName">Nombre completo</Label>
          <Input
            id="fullName"
            value={form.fullName}
            onChange={(e) =>
              setForm((f) => ({ ...f, fullName: e.target.value }))
            }
            required
          />
        </div>

        {showDeliveryFields ? (
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label htmlFor="phone">Celular</Label>
              <Input
                id="phone"
                value={form.phone}
                onChange={(e) =>
                  setForm((f) => ({ ...f, phone: e.target.value }))
                }
                placeholder="987654321"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="documentNumber">N° de documento</Label>
              <Input
                id="documentNumber"
                value={form.documentNumber ?? ''}
                disabled
              />
            </div>
          </div>
        ) : (
          <div className="space-y-1">
            <Label htmlFor="phone">Celular</Label>
            <Input
              id="phone"
              value={form.phone}
              onChange={(e) =>
                setForm((f) => ({ ...f, phone: e.target.value }))
              }
              placeholder="987654321"
            />
          </div>
        )}

        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        {/* green-700 en vez de green-600: el 600 queda en ~3.3:1 sobre blanco,
            por debajo del 4.5:1 de texto pequeño (el 700 da ~5:1). */}
        {success && <p className="text-sm text-green-700">Guardado.</p>}

        <Button type="submit" variant="lime" disabled={isPending}>
          {isPending ? 'Guardando…' : 'Guardar cambios'}
        </Button>
      </form>

      {/* El separador se queda aquí y no dentro de PasswordChangeForm: en
          esta página separa dos bloques del mismo formulario, pero en la
          página del repartidor el componente va en su propia tarjeta, con
          título propio, donde un borde superior sobraría. */}
      {showPasswordChange && (
        <div className="border-t pt-6">
          <PasswordChangeForm />
        </div>
      )}
    </div>
  )
}
