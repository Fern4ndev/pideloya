'use client'

import { useTransition } from 'react'
import {
  ImageUploader,
  type UploadedImage,
} from '@/components/features/restaurants/ImageUploader'
import { saveRestaurantCover } from '@/lib/actions/restaurants'

export function CoverUploader({
  currentCoverUrl,
  restaurantId,
}: {
  currentCoverUrl: string | null
  restaurantId: string
}) {
  const [, startTransition] = useTransition()

  function handleUploaded(image: UploadedImage) {
    startTransition(() => {
      saveRestaurantCover(image)
    })
  }

  return (
    <ImageUploader
      label="Portada del negocio"
      currentUrl={currentCoverUrl}
      folder={`/restaurants/${restaurantId}/cover`}
      onUploaded={handleUploaded}
      size="wide"
      align="center"
      helpText="Se muestra como foto principal de tu tarjeta."
    />
  )
}
