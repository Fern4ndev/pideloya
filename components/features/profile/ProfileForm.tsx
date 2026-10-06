'use client'

import { useState, useTransition, type SubmitEvent } from 'react'
import { updateProfile } from '@/lib/actions/profile'
import { PasswordChangeForm } from './PasswordChangeForm'
import { PasswordChangeDialog } from './PasswordChangeDialog'
import { useOptionalProfileDraft } from './ProfileDraftProvider'
import { AddressFormDialog } from '@/components/features/addresses/AddressFormDialog'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { MapPinIcon } from 'lucide-react'
import { useToast } from '@/components/ui/toast'

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
  showPasswordModal = false,
  address,
}: {
  email: string
  initialData: ProfileFormData
  showDeliveryFields?: boolean
  showPasswordChange?: boolean
  showAccountAvatar?: boolean
  showPasswordModal?: boolean
  address?: {
    id: string
    label: string | null
    address_text: string
    reference: string | null
    latitude: number | null
    longitude: number | null
  } | null
}) {
  const [form, setForm] = useState(initialData)
  const initial = form.fullName.trim().charAt(0).toUpperCase() || '?'
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const { success: toastSuccess, error: toastError } = useToast()
  // Solo existe dentro del perfil del repartidor (provider del draft de
  // fotos/QR); en el resto de paneles es null y no cambia nada.
  const draft = useOptionalProfileDraft()

  // `form` empieza como copia exacta de `initialData` y solo cambia por
  // escritura del usuario, así que JSON.stringify basta para detectar si
  // hay algo pendiente. Sin cambios no se invoca la Server Action: cada
  // llamada re-renderiza la ruta (revalidatePath), y un click que no
  // cambia nada no debería refrescar la página.
  const fieldsDirty = JSON.stringify(form) !== JSON.stringify(initialData)
  const isDirty = fieldsDirty || (draft?.hasMediaChanges ?? false)

  function handleSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!isDirty) return
    setError(null)
    startTransition(async () => {
      if (fieldsDirty) {
        try {
          await updateProfile(form)
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Algo salió mal')
          return
        }
      }

      if (draft?.hasMediaChanges) {
        try {
          await draft.commitMedia()
        } catch (err) {
          toastError(
            'No se pudieron guardar las imágenes',
            err instanceof Error ? err.message : undefined
          )
          return
        }
      }

      toastSuccess('Cambios guardados')
    })
  }

  return (
    <div className="w-full space-y-8">
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

      <form onSubmit={handleSubmit} className="space-y-5">
        <section className="space-y-4">
          <div>
            <h2 className="text-base font-semibold">Información personal</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Tus datos de contacto para tus pedidos.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="email">Correo electrónico</Label>
              <Input id="email" type="email" value={email} disabled />
            </div>

            <div className="space-y-1.5">
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

            <div className="space-y-1.5">
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

            {showDeliveryFields && (
              <div className="space-y-1.5">
                <Label htmlFor="documentNumber">N° de documento</Label>
                <Input
                  id="documentNumber"
                  value={form.documentNumber ?? ''}
                  disabled
                />
              </div>
            )}
          </div>
        </section>

        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="submit"
            variant="lime"
            disabled={isPending || !isDirty}
          >
            {isPending ? 'Guardando…' : 'Guardar cambios'}
          </Button>
          {showPasswordModal && <PasswordChangeDialog />}
        </div>
      </form>

      {address && (
        <section className="space-y-4 border-t pt-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="flex items-center gap-2 text-base font-semibold">
                <MapPinIcon className="h-4 w-4 text-brand-500" />
                Dirección de entrega
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Dirección guardada para recibir tus pedidos.
              </p>
            </div>
            <AddressFormDialog
              mode="edit"
              initialData={{
                id: address.id,
                label: address.label ?? '',
                addressText: address.address_text,
                reference: address.reference ?? '',
                latitude: address.latitude,
                longitude: address.longitude,
              }}
            />
          </div>
          <div className="space-y-1 rounded-2xl border border-border/70 bg-muted/30 p-4">
            <p className="text-sm font-medium">{address.label || 'Mi dirección'}</p>
            <p className="text-sm text-muted-foreground">{address.address_text}</p>
            {address.reference && (
              <p className="text-sm text-muted-foreground">
                Referencia: {address.reference}
              </p>
            )}
          </div>
        </section>
      )}

      {!address && (
        <section className="space-y-4 border-t pt-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="flex items-center gap-2 text-base font-semibold">
                <MapPinIcon className="h-4 w-4 text-brand-500" />
                Dirección de entrega
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Aún no tienes una dirección guardada.
              </p>
            </div>
            <AddressFormDialog mode="create" />
          </div>
        </section>
      )}

      {showPasswordChange && (
        <div className="border-t pt-6">
          <PasswordChangeForm />
        </div>
      )}
    </div>
  )
}
