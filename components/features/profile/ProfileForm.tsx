'use client'

import { useState, useTransition, type SubmitEvent } from 'react'
import { updateProfile, changePassword } from '@/lib/actions/profile'
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
}: {
  email: string
  initialData: ProfileFormData
  showDeliveryFields?: boolean
  showPasswordChange?: boolean
}) {
  const [form, setForm] = useState(initialData)
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
        {success && <p className="text-sm text-green-600">Guardado.</p>}

        <Button type="submit" variant="lime" disabled={isPending}>
          {isPending ? 'Guardando…' : 'Guardar cambios'}
        </Button>
      </form>

      {showPasswordChange && <PasswordChangeForm />}
    </div>
  )
}

function PasswordChangeForm() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setSuccess(false)

    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres')
      return
    }
    if (password !== confirm) {
      setError('Las contraseñas no coinciden')
      return
    }

    startTransition(async () => {
      try {
        await changePassword(password)
        setPassword('')
        setConfirm('')
        setSuccess(true)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Algo salió mal')
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 border-t pt-6">
      <h2 className="text-sm font-medium">Cambiar contraseña</h2>
      <div className="space-y-1">
        <Label htmlFor="newPassword">Nueva contraseña</Label>
        <Input
          id="newPassword"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="confirmPassword">Confirmar contraseña</Label>
        <Input
          id="confirmPassword"
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
      </div>

      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {success && (
        <p className="text-sm text-green-600">Contraseña actualizada.</p>
      )}

      <Button type="submit" variant="outline" disabled={isPending}>
        {isPending ? 'Guardando…' : 'Actualizar contraseña'}
      </Button>
    </form>
  )
}