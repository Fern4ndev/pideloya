'use client'

import { useState, useTransition, type SubmitEvent } from 'react'
import { updateProfile } from '@/lib/actions/profile'
import { PasswordChangeForm } from './PasswordChangeForm'
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

/** Vocabulario de vehículos de reparto. */
const VEHICLE_TYPES: readonly string[] = [
  'Moto',
  'Bicicleta',
  'Auto',
  'A pie',
]

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

  // El valor guardado puede estar fuera de esta lista: el panel de admin
  // edita el vehículo como texto libre, así que un perfil puede tener
  // "moto", "Cuatrimoto", etc. Si no está en la lista se agrega como
  // opción extra — así el select muestra el valor real del perfil en vez
  // de un campo vacío que invitaría a sobrescribirlo sin querer.
  const vehicleOptions =
    form.vehicleType && !VEHICLE_TYPES.includes(form.vehicleType)
      ? [...VEHICLE_TYPES, form.vehicleType]
      : VEHICLE_TYPES

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
            <div className="col-span-2 space-y-1">
              <Label htmlFor="vehicleType">Vehículo</Label>
              <Select
                value={form.vehicleType ?? ''}
                onValueChange={(value) =>
                  setForm((f) => ({ ...f, vehicleType: value ?? '' }))
                }
              >
                <SelectTrigger id="vehicleType" className="w-full">
                  <SelectValue placeholder="Selecciona tu vehículo" />
                </SelectTrigger>
                <SelectContent>
                  {vehicleOptions.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
