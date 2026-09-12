'use client'

import { useState, useTransition, type SubmitEvent } from 'react'
import { useRouter } from 'next/navigation'
import { createProduct, updateProduct } from '@/lib/actions/products'
import {
  ImageUploader,
  type UploadedImage,
} from '@/components/features/restaurants/ImageUploader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export interface ProductFormData {
  name: string
  description: string
  price: string
  imageUrl: string
  imageFileId: string
  available: boolean
  categoryId: string
}

const EMPTY_FORM: ProductFormData = {
  name: '',
  description: '',
  price: '',
  imageUrl: '',
  imageFileId: '',
  available: true,
  categoryId: '',
}

export function ProductForm({
  productId,
  initialData,
  categories = [],
  restaurantId,
}: {
  productId?: string
  initialData?: ProductFormData
  categories?: { id: string; name: string }[]
  restaurantId: string
}) {
  const router = useRouter()
  const [form, setForm] = useState<ProductFormData>(initialData ?? EMPTY_FORM)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    startTransition(async () => {
      try {
        const payload = {
          name: form.name,
          description: form.description,
          price: Number(form.price),
          imageUrl: form.imageUrl,
          imageFileId: form.imageFileId,
          available: form.available,
          categoryId: form.categoryId,
        }

        if (productId) {
          await updateProduct(productId, payload)
        } else {
          await createProduct(payload)
        }

        router.push('/restaurante/productos')
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Algo salió mal')
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-md space-y-4">
      <div className="space-y-1">
        <Label htmlFor="name">Nombre</Label>
        <Input
          id="name"
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          placeholder="Pollo a la brasa 1/4"
          required
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor="description">Descripción</Label>
        <Textarea
          id="description"
          value={form.description}
          onChange={(e) =>
            setForm((f) => ({ ...f, description: e.target.value }))
          }
          placeholder="Con papas, ensalada y cremas"
          rows={3}
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor="price">Precio (S/)</Label>
        <Input
          id="price"
          type="number"
          step="0.10"
          min="0"
          value={form.price}
          onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
          required
        />
      </div>

      <ImageUploader
        label="Foto del producto"
        currentUrl={form.imageUrl || null}
        folder={`/restaurants/${restaurantId}/products`}
        onUploaded={(image: UploadedImage) =>
          setForm((f) => ({ ...f, imageUrl: image.url, imageFileId: image.fileId }))
        }
      />

      <div className="space-y-1">
        <Label htmlFor="categoryId">
          Categoría{' '}
          <span className="font-normal text-muted-foreground">(opcional)</span>
        </Label>
        <Select
          value={form.categoryId || 'none'}
          onValueChange={(value) =>
            setForm((f) => ({
              ...f,
              categoryId: !value || value === 'none' ? '' : value,
            }))
          }
        >
          <SelectTrigger id="categoryId" className="w-full">
            <SelectValue placeholder="Sin categoría" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Sin categoría</SelectItem>
            {categories.map((category) => (
              <SelectItem key={category.id} value={category.id}>
                {category.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center justify-between rounded-lg border px-3 py-2.5">
        <Label htmlFor="available" className="cursor-pointer">
          Disponible para pedir
        </Label>
        <Switch
          id="available"
          checked={form.available}
          onCheckedChange={(checked) =>
            setForm((f) => ({ ...f, available: checked }))
          }
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex gap-2">
        <Button type="submit" disabled={isPending}>
          {isPending
            ? 'Guardando…'
            : productId
              ? 'Guardar cambios'
              : 'Crear producto'}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => router.push('/restaurante/productos')}
        >
          Cancelar
        </Button>
      </div>
    </form>
  )
}