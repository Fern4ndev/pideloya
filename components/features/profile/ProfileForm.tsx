'use client'

import { useState, useTransition, type SubmitEvent } from 'react'
import { updateProfile, changePassword } from '@/lib/actions/profile'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const DOCUMENT_TYPES = ['DNI', 'Carné de extranjería', 'Pasaporte']
const VEHICLE_TYPES = ['Moto', 'Mototaxi', 'Bicicleta', 'A pie', 'Auto']

export interface ProfileFormData {
  fullName: string
  phone: string
  documentType?: string | null
  documentNumber?: string | null
  vehicleType?: string | null
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
          <p className="text-xs text-muted-foreground">
            El correo no se puede cambiar desde aquí.
          </p>
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

        <div className="space-y-1">
          <Label htmlFor="phone">Celular</Label>
          <Input
            id="phone"
            value={form.phone}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            placeholder="987654321"
          />
        </div>

        {showDeliveryFields && (
          <>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label htmlFor="documentType">Tipo de documento</Label>
                <Select
                  value={form.documentType ?? ''}
                  onValueChange={(value) =>
                    setForm((f) => ({ ...f, documentType: value }))
                  }
                >
                  <SelectTrigger id="documentType" className="w-full">
                    <SelectValue placeholder="Selecciona" />
                  </SelectTrigger>
                  <SelectContent>
                    {DOCUMENT_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="documentNumber">N° de documento</Label>
                <Input
                  id="documentNumber"
                  value={form.documentNumber ?? ''}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, documentNumber: e.target.value }))
                  }
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="vehicleType">Vehículo</Label>
              <Select
                value={form.vehicleType ?? ''}
                onValueChange={(value) =>
                  setForm((f) => ({ ...f, vehicleType: value }))
                }
              >
                <SelectTrigger id="vehicleType" className="w-full">
                  <SelectValue placeholder="Selecciona" />
                </SelectTrigger>
                <SelectContent>
                  {VEHICLE_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}
        {success && <p className="text-sm text-green-600">Guardado.</p>}

        <Button type="submit" disabled={isPending}>
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

      {error && <p className="text-sm text-destructive">{error}</p>}
      {success && (
        <p className="text-sm text-green-600">Contraseña actualizada.</p>
      )}

      <Button type="submit" variant="outline" disabled={isPending}>
        {isPending ? 'Guardando…' : 'Actualizar contraseña'}
      </Button>
    </form>
  )
}