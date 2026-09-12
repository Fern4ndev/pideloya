'use client'

import { useActionState } from 'react'
import { useRouter } from 'next/navigation'
import { updateRestaurant } from '@/lib/actions/restaurants'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'

type RestaurantInfo = {
  name: string
  description: string | null
  addressText: string | null
  whatsapp: string | null
  foodType: string | null
}

export function RestaurantInfoForm({
  initialData,
}: {
  initialData: RestaurantInfo
}) {
  const router = useRouter()
  const [state, formAction, isPending] = useActionState(
    async (_prev: { error?: string } | null, formData: FormData) => {
      try {
        await updateRestaurant({
          name: formData.get('name') as string,
          description: (formData.get('description') as string) || '',
          addressText: formData.get('addressText') as string,
          whatsapp: (formData.get('whatsapp') as string) || '',
          foodType: formData.get('foodType') as string,
        })
        toast.success('Negocio actualizado correctamente')
        router.refresh()
        return { success: true }
      } catch (e) {
        return { error: e instanceof Error ? e.message : 'Error al actualizar' }
      }
    },
    null
  )

  return (
    <form action={formAction} className="space-y-4 max-w-lg">
      <div className="space-y-2">
        <Label htmlFor="name">Nombre del negocio</Label>
        <Input
          id="name"
          name="name"
          defaultValue={initialData.name}
          required
          minLength={2}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Descripción</Label>
        <Input
          id="description"
          name="description"
          defaultValue={initialData.description ?? ''}
          placeholder="Comida criolla, parrilla, etc."
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="addressText">Dirección</Label>
        <Input
          id="addressText"
          name="addressText"
          defaultValue={initialData.addressText ?? ''}
          required
          minLength={3}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="whatsapp">WhatsApp (9 dígitos)</Label>
        <Input
          id="whatsapp"
          name="whatsapp"
          defaultValue={initialData.whatsapp ?? ''}
          placeholder="987654321"
          pattern="9[0-9]{8}"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="foodType">Tipo de comida</Label>
        <Input
          id="foodType"
          name="foodType"
          defaultValue={initialData.foodType ?? ''}
          required
          minLength={1}
        />
      </div>

      {state?.error && (
        <p className="text-sm text-destructive">{state.error}</p>
      )}

      <Button type="submit" disabled={isPending}>
        {isPending ? 'Guardando...' : 'Guardar cambios'}
      </Button>
    </form>
  )
}
