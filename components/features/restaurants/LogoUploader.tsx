'use client'

import { useTransition } from 'react'
import {
  ImageUploader,
  type UploadedImage,
} from '@/components/features/restaurants/ImageUploader'
import { saveRestaurantLogo } from '@/lib/actions/restaurants'

export function LogoUploader({
  currentLogoUrl,
  restaurantId,
}: {
  currentLogoUrl: string | null
  restaurantId: string
}) {
  const [, startTransition] = useTransition()

  function handleUploaded(image: UploadedImage) {
    startTransition(() => {
      saveRestaurantLogo(image)
    })
  }

  return (
    <ImageUploader
      label="Logo del negocio"
      currentUrl={currentLogoUrl}
      folder={`/restaurants/${restaurantId}/logo`}
      onUploaded={handleUploaded}
    />
  )
}